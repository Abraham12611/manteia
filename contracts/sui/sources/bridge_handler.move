module manteia::bridge_handler {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use sui::event;
    use std::vector;
    use std::string::{Self, String};

    // Error codes
    const EInvalidAmount: u64 = 0;
    const EInvalidRecipient: u64 = 1;
    const EInvalidSwapId: u64 = 2;
    const ESwapAlreadyProcessed: u64 = 3;
    const EInsufficientBalance: u64 = 4;
    const ESwapExpired: u64 = 5;
    const EUnauthorized: u64 = 6;
    const EInvalidTokenType: u64 = 7;

    // Constants
    const SWAP_EXPIRY_DURATION: u64 = 3600000; // 1 hour in milliseconds
    const MIN_SWAP_AMOUNT: u64 = 1000; // Minimum swap amount to prevent dust

    // Bridge swap request object
    public struct BridgeSwapRequest<phantom T> has key, store {
        id: UID,
        swap_id: vector<u8>,
        recipient: address,
        amount: u64,
        target_token_type: String, // Target token type (e.g., "SUI")
        created_at: u64,
        expiry: u64,
        is_processed: bool,
        balance: Balance<T>,
    }

    // Global configuration and registry
    public struct BridgeRegistry has key {
        id: UID,
        admin: address,
        authorized_bridges: vector<address>,
        processed_swaps: vector<vector<u8>>,
        total_volume: u64,
        fee_rate: u64, // Fee rate in basis points (e.g., 30 = 0.3%)
        fee_collector: address,
    }

    // Events
    public struct BridgeRequestReceived has copy, drop {
        swap_id: vector<u8>,
        recipient: address,
        token_type: String,
        amount: u64,
        expiry: u64,
    }

    public struct SwapExecuted has copy, drop {
        swap_id: vector<u8>,
        recipient: address,
        input_amount: u64,
        output_amount: u64,
        token_in: String,
        token_out: String,
    }

    public struct SwapFailed has copy, drop {
        swap_id: vector<u8>,
        recipient: address,
        reason: String,
    }

    public struct FeeCollected has copy, drop {
        swap_id: vector<u8>,
        fee_amount: u64,
        fee_collector: address,
    }

    // Initialize the bridge registry (called once during deployment)
    fun init(ctx: &mut TxContext) {
        let registry = BridgeRegistry {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            authorized_bridges: vector::empty<address>(),
            processed_swaps: vector::empty<vector<u8>>(),
            total_volume: 0,
            fee_rate: 30, // 0.3% default fee
            fee_collector: tx_context::sender(ctx),
        };

        transfer::share_object(registry);
    }

    // Receive bridged USDC and create swap request
    public fun receive_bridged_usdc<T>(
        coin: Coin<T>,
        recipient: address,
        swap_id: vector<u8>,
        target_token_type: String,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&coin);
        assert!(amount > MIN_SWAP_AMOUNT, EInvalidAmount);
        assert!(recipient != @0x0, EInvalidRecipient);
        assert!(vector::length(&swap_id) > 0, EInvalidSwapId);

        let current_time = clock::timestamp_ms(clock);
        let expiry = current_time + SWAP_EXPIRY_DURATION;

        let request = BridgeSwapRequest<T> {
            id: object::new(ctx),
            swap_id,
            recipient,
            amount,
            target_token_type,
            created_at: current_time,
            expiry,
            is_processed: false,
            balance: coin::into_balance(coin),
        };

        // Emit event
        event::emit(BridgeRequestReceived {
            swap_id,
            recipient,
            token_type: target_token_type,
            amount,
            expiry,
        });

        // Share the request object so it can be processed
        transfer::share_object(request);
    }

    // Process swap request and execute DEX swap (to be called by authorized relayer)
    public fun process_swap_request<TokenIn, TokenOut>(
        request: &mut BridgeSwapRequest<TokenIn>,
        registry: &mut BridgeRegistry,
        output_coin: Coin<TokenOut>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(is_authorized_bridge(registry, sender), EUnauthorized);
        assert!(!request.is_processed, ESwapAlreadyProcessed);

        let current_time = clock::timestamp_ms(clock);
        assert!(current_time < request.expiry, ESwapExpired);

        let output_amount = coin::value(&output_coin);
        let input_amount = balance::value(&request.balance);

        // Calculate and collect fee
        let fee_amount = (output_amount * registry.fee_rate) / 10000;
        let net_output_amount = output_amount - fee_amount;

        if (fee_amount > 0) {
            let fee_coin = coin::split(&mut output_coin, fee_amount, ctx);
            transfer::public_transfer(fee_coin, registry.fee_collector);

            event::emit(FeeCollected {
                swap_id: request.swap_id,
                fee_amount,
                fee_collector: registry.fee_collector,
            });
        }

        // Mark as processed
        request.is_processed = true;

        // Record processed swap
        vector::push_back(&mut registry.processed_swaps, request.swap_id);
        registry.total_volume = registry.total_volume + input_amount;

        // Transfer output tokens to recipient
        transfer::public_transfer(output_coin, request.recipient);

        // Emit swap executed event
        event::emit(SwapExecuted {
            swap_id: request.swap_id,
            recipient: request.recipient,
            input_amount,
            output_amount: net_output_amount,
            token_in: string::utf8(b"USDC"), // Assuming input is always USDC
            token_out: request.target_token_type,
        });
    }

    // Cancel expired swap request and refund
    public fun cancel_expired_swap<T>(
        request: &mut BridgeSwapRequest<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ): Coin<T> {
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time >= request.expiry, ESwapExpired);
        assert!(!request.is_processed, ESwapAlreadyProcessed);

        // Mark as processed to prevent double spending
        request.is_processed = true;

        // Extract the balance and return as coin
        let balance = balance::split(&mut request.balance, balance::value(&request.balance));
        let refund_coin = coin::from_balance(balance, ctx);

        event::emit(SwapFailed {
            swap_id: request.swap_id,
            recipient: request.recipient,
            reason: string::utf8(b"Swap expired"),
        });

        refund_coin
    }

    // Emergency refund (admin only)
    public fun emergency_refund<T>(
        request: &mut BridgeSwapRequest<T>,
        registry: &BridgeRegistry,
        ctx: &mut TxContext
    ): Coin<T> {
        assert!(tx_context::sender(ctx) == registry.admin, EUnauthorized);
        assert!(!request.is_processed, ESwapAlreadyProcessed);

        // Mark as processed
        request.is_processed = true;

        // Extract balance and return as coin
        let balance = balance::split(&mut request.balance, balance::value(&request.balance));
        let refund_coin = coin::from_balance(balance, ctx);

        event::emit(SwapFailed {
            swap_id: request.swap_id,
            recipient: request.recipient,
            reason: string::utf8(b"Emergency refund"),
        });

        refund_coin
    }

    // Direct swap function for USDC to SUI (simplified for common case)
    public fun swap_usdc_to_sui<USDC, SUI>(
        request: &mut BridgeSwapRequest<USDC>,
        registry: &mut BridgeRegistry,
        sui_coin: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        process_swap_request<USDC, SUI>(request, registry, sui_coin, clock, ctx);
    }

    // Administrative functions

    // Add authorized bridge
    public fun add_authorized_bridge(
        registry: &mut BridgeRegistry,
        bridge_address: address,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == registry.admin, EUnauthorized);
        vector::push_back(&mut registry.authorized_bridges, bridge_address);
    }

    // Remove authorized bridge
    public fun remove_authorized_bridge(
        registry: &mut BridgeRegistry,
        bridge_address: address,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == registry.admin, EUnauthorized);
        let (found, index) = vector::index_of(&registry.authorized_bridges, &bridge_address);
        if (found) {
            vector::swap_remove(&mut registry.authorized_bridges, index);
        };
    }

    // Update fee rate
    public fun update_fee_rate(
        registry: &mut BridgeRegistry,
        new_fee_rate: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == registry.admin, EUnauthorized);
        assert!(new_fee_rate <= 1000, EInvalidAmount); // Max 10% fee
        registry.fee_rate = new_fee_rate;
    }

    // Update fee collector
    public fun update_fee_collector(
        registry: &mut BridgeRegistry,
        new_fee_collector: address,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == registry.admin, EUnauthorized);
        assert!(new_fee_collector != @0x0, EInvalidRecipient);
        registry.fee_collector = new_fee_collector;
    }

    // Transfer admin role
    public fun transfer_admin(
        registry: &mut BridgeRegistry,
        new_admin: address,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == registry.admin, EUnauthorized);
        assert!(new_admin != @0x0, EInvalidRecipient);
        registry.admin = new_admin;
    }

    // View functions

    // Check if address is authorized bridge
    public fun is_authorized_bridge(registry: &BridgeRegistry, bridge_address: address): bool {
        vector::contains(&registry.authorized_bridges, &bridge_address)
    }

    // Get swap request details
    public fun get_swap_request_info<T>(request: &BridgeSwapRequest<T>): (
        vector<u8>,
        address,
        u64,
        String,
        u64,
        u64,
        bool
    ) {
        (
            request.swap_id,
            request.recipient,
            request.amount,
            request.target_token_type,
            request.created_at,
            request.expiry,
            request.is_processed
        )
    }

    // Get registry info
    public fun get_registry_info(registry: &BridgeRegistry): (
        address,
        u64,
        u64,
        address,
        u64
    ) {
        (
            registry.admin,
            vector::length(&registry.authorized_bridges),
            registry.total_volume,
            registry.fee_collector,
            registry.fee_rate
        )
    }

    // Check if swap was already processed
    public fun is_swap_processed(registry: &BridgeRegistry, swap_id: vector<u8>): bool {
        vector::contains(&registry.processed_swaps, &swap_id)
    }

    // Get remaining balance in request
    public fun get_remaining_balance<T>(request: &BridgeSwapRequest<T>): u64 {
        balance::value(&request.balance)
    }

    // Check if swap request is expired
    public fun is_swap_expired<T>(request: &BridgeSwapRequest<T>, clock: &Clock): bool {
        let current_time = clock::timestamp_ms(clock);
        current_time >= request.expiry
    }
}