module manteia::escrow {
    use sui::object::{UID, ID};
    use sui::transfer;
    use sui::tx_context::TxContext;
    use sui::coin::{Self, Coin};
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::balance::{Self, Balance};
    use std::vector;
    use std::hash;

    // Error codes
    const EInvalidSecret: u64 = 0;
    const ENotExpired: u64 = 1;
    const EAlreadyExpired: u64 = 2;
    const EInvalidSender: u64 = 3;
    const EInvalidResolver: u64 = 4;
    const EInsufficientAmount: u64 = 5;
    const EInvalidHashLength: u64 = 6;
    const EEscrowAlreadyClaimed: u64 = 7;

    // Constants
    const HASH_LENGTH: u64 = 32;

    // Escrow object for holding locked funds
    struct Escrow<phantom T> has key, store {
        id: UID,
        sender: address,
        recipient: address,
        resolver: address,
        amount: u64,
        hash: vector<u8>,
        expiry: u64,
        cross_chain_id: vector<u8>, // Links to Ethereum escrow
        is_claimed: bool,
        balance: Balance<T>,
    }

    // Events for indexing
    struct EscrowCreated has copy, drop {
        escrow_id: ID,
        sender: address,
        recipient: address,
        resolver: address,
        amount: u64,
        hash: vector<u8>,
        expiry: u64,
        cross_chain_id: vector<u8>,
    }

    struct EscrowClaimed has copy, drop {
        escrow_id: ID,
        claimer: address,
        secret: vector<u8>,
        amount: u64,
    }

    struct EscrowCancelled has copy, drop {
        escrow_id: ID,
        refund_to: address,
        amount: u64,
    }

    // Create a new escrow
    public fun create_escrow<T>(
        coin: Coin<T>,
        recipient: address,
        resolver: address,
        hash: vector<u8>,
        duration_ms: u64,
        cross_chain_id: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(vector::length(&hash) == HASH_LENGTH, EInvalidHashLength);
        assert!(coin::value(&coin) > 0, EInsufficientAmount);

        let sender = tx_context::sender(ctx);
        let amount = coin::value(&coin);
        let expiry = clock::timestamp_ms(clock) + duration_ms;

        let escrow = Escrow {
            id: sui::object::new(ctx),
            sender,
            recipient,
            resolver,
            amount,
            hash,
            expiry,
            cross_chain_id,
            is_claimed: false,
            balance: coin::into_balance(coin),
        };

        let escrow_id = sui::object::id(&escrow);

        // Emit event
        event::emit(EscrowCreated {
            escrow_id,
            sender,
            recipient,
            resolver,
            amount,
            hash,
            expiry,
            cross_chain_id,
        });

        // Share the escrow object
        transfer::share_object(escrow);
    }

    // Claim escrow with secret
    public fun claim_with_secret<T>(
        escrow: &mut Escrow<T>,
        secret: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ): Coin<T> {
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time < escrow.expiry, EAlreadyExpired);
        assert!(!escrow.is_claimed, EEscrowAlreadyClaimed);

        // Verify the secret
        let computed_hash = hash::sha3_256(secret);
        assert!(computed_hash == escrow.hash, EInvalidSecret);

        let claimer = tx_context::sender(ctx);
        // Allow recipient or resolver to claim
        assert!(
            claimer == escrow.recipient || claimer == escrow.resolver,
            EInvalidSender
        );

        // Mark as claimed
        escrow.is_claimed = true;

        // Extract the balance
        let amount = balance::value(&escrow.balance);
        let balance = balance::split(&mut escrow.balance, amount);

        // Emit event
        event::emit(EscrowClaimed {
            escrow_id: sui::object::id(escrow),
            claimer,
            secret,
            amount,
        });

        // Convert balance to coin and return
        coin::from_balance(balance, ctx)
    }

    // Cancel expired escrow
    public fun cancel_escrow<T>(
        escrow: &mut Escrow<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ): Coin<T> {
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time >= escrow.expiry, ENotExpired);
        assert!(!escrow.is_claimed, EEscrowAlreadyClaimed);

        let sender = tx_context::sender(ctx);
        assert!(sender == escrow.sender, EInvalidSender);

        // Mark as claimed to prevent double spending
        escrow.is_claimed = true;

        // Extract the balance
        let amount = balance::value(&escrow.balance);
        let balance = balance::split(&mut escrow.balance, amount);

        // Emit event
        event::emit(EscrowCancelled {
            escrow_id: sui::object::id(escrow),
            refund_to: sender,
            amount,
        });

        // Convert balance to coin and return
        coin::from_balance(balance, ctx)
    }

    // View functions
    public fun get_escrow_details<T>(escrow: &Escrow<T>): (
        address,
        address,
        address,
        u64,
        vector<u8>,
        u64,
        vector<u8>,
        bool
    ) {
        (
            escrow.sender,
            escrow.recipient,
            escrow.resolver,
            escrow.amount,
            escrow.hash,
            escrow.expiry,
            escrow.cross_chain_id,
            escrow.is_claimed
        )
    }

    // Check if escrow is expired
    public fun is_expired<T>(escrow: &Escrow<T>, clock: &Clock): bool {
        clock::timestamp_ms(clock) >= escrow.expiry
    }

    // Check if escrow is claimed
    public fun is_claimed<T>(escrow: &Escrow<T>): bool {
        escrow.is_claimed
    }

    // Get remaining balance
    public fun get_balance<T>(escrow: &Escrow<T>): u64 {
        balance::value(&escrow.balance)
    }
}