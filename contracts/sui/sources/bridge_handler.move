module manteia::bridge_handler_simple {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use std::vector;
    use std::string::{Self, String};

    // Error codes
    const EInvalidAmount: u64 = 0;
    const ESwapExpired: u64 = 1;
    const EUnauthorized: u64 = 2;
    const EInvalidRecipient: u64 = 3;

    // Bridge swap request object
    public struct BridgeSwapRequest<phantom T> has key, store {
        id: UID,
        swap_id: vector<u8>,
        recipient: address,
        amount: u64,
        target_token_type: String,
        created_at: u64,
        expiry: u64,
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

    // Initialize the bridge registry (called once during deployment)
    public fun initialize_bridge_registry(ctx: &mut TxContext) {
        let registry = BridgeRegistry {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            authorized_bridges: vector::empty(),
            processed_swaps: vector::empty(),
            total_volume: 0,
            fee_rate: 30, // 0.3% default fee
            fee_collector: tx_context::sender(ctx),
        };
        transfer::share_object(registry);
    }

    // Receive bridged tokens and create swap request
    public fun receive_bridged_tokens<T>(
        registry: &mut BridgeRegistry,
        bridged_coin: Coin<T>,
        swap_id: vector<u8>,
        recipient: address,
        target_token_type: String,
        expiry_duration_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&bridged_coin);
        assert!(amount > 0, EInvalidAmount);
        assert!(recipient != @0x0, EInvalidRecipient);

        let current_time = clock::timestamp_ms(clock);
        let expiry = current_time + expiry_duration_ms;

        let request = BridgeSwapRequest<T> {
            id: object::new(ctx),
            swap_id: swap_id,
            recipient,
            amount,
            target_token_type: target_token_type,
            created_at: current_time,
            expiry,
            balance: coin::into_balance(bridged_coin),
        };

        event::emit(BridgeRequestReceived {
            swap_id: request.swap_id,
            recipient: request.recipient,
            token_type: request.target_token_type,
            amount: request.amount,
            expiry: request.expiry,
        });

        transfer::share_object(request);
    }

    // Process swap request and execute DEX swap (to be called by authorized relayer)
    public fun process_swap_request<TokenIn, TokenOut>(
        request: BridgeSwapRequest<TokenIn>,
        registry: &mut BridgeRegistry,
        mut output_coin: Coin<TokenOut>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(is_authorized_bridge(registry, sender), EUnauthorized);

        let current_time = clock::timestamp_ms(clock);
        assert!(current_time < request.expiry, ESwapExpired);

        // Extract values before destructuring
        let swap_id = request.swap_id;
        let recipient = request.recipient;
        let input_amount = request.amount;
        let target_token_type = request.target_token_type;

        let BridgeSwapRequest {
            id,
            swap_id: _,
            recipient: _,
            amount: _,
            target_token_type: _,
            created_at: _,
            expiry: _,
            balance,
        } = request;

        let output_amount = coin::value(&output_coin);

        // Calculate and collect fee
        let fee_amount = (output_amount * registry.fee_rate) / 10000;
        let net_output_amount = output_amount - fee_amount;

        if (fee_amount > 0) {
            let fee_coin = coin::split(&mut output_coin, fee_amount, ctx);
            transfer::public_transfer(fee_coin, registry.fee_collector);
        };

        // Record processed swap
        vector::push_back(&mut registry.processed_swaps, swap_id);
        registry.total_volume = registry.total_volume + input_amount;

        // Transfer output tokens to recipient
        transfer::public_transfer(output_coin, recipient);

        // Destroy the used balance
        balance::destroy_zero(balance);
        object::delete(id);

        // Emit swap executed event
        event::emit(SwapExecuted {
            swap_id,
            recipient,
            input_amount,
            output_amount: net_output_amount,
            token_in: string::utf8(b"USDC"), // Simplified for USDC bridges
            token_out: target_token_type,
        });
    }

    // Helper function to check if address is authorized bridge
    public fun is_authorized_bridge(registry: &BridgeRegistry, bridge: address): bool {
        vector::contains(&registry.authorized_bridges, &bridge) || bridge == registry.admin
    }

    // Admin function to add authorized bridge
    public fun add_authorized_bridge(
        registry: &mut BridgeRegistry,
        bridge: address,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == registry.admin, EUnauthorized);
        if (!vector::contains(&registry.authorized_bridges, &bridge)) {
            vector::push_back(&mut registry.authorized_bridges, bridge);
        }
    }

    // Admin function to set fee rate
    public fun set_fee_rate(
        registry: &mut BridgeRegistry,
        new_fee_rate: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == registry.admin, EUnauthorized);
        assert!(new_fee_rate <= 1000, EInvalidAmount); // Max 10% fee
        registry.fee_rate = new_fee_rate;
    }

    // Get swap request details
    public fun get_swap_request_details<T>(request: &BridgeSwapRequest<T>): (vector<u8>, address, u64, u64) {
        (request.swap_id, request.recipient, request.amount, request.expiry)
    }
}