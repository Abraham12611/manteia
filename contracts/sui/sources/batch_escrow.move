module manteia::batch_escrow {
    use manteia::escrow;
    use manteia::utils;
    use sui::object::{UID, ID};
    use sui::table::{Self, Table};
    use sui::coin::Coin;
    use sui::clock::Clock;
    use sui::tx_context::TxContext;
    use sui::transfer;
    use sui::event;
    use std::vector;

    // Error codes
    const EInvalidBatchSize: u64 = 0;
    const EMismatchedArrayLengths: u64 = 1;
    const EBatchNotFound: u64 = 2;
    const EPartAlreadyClaimed: u64 = 3;
    const EInvalidPartIndex: u64 = 4;
    const EBatchAlreadyCompleted: u64 = 5;

    // Constants
    const MAX_BATCH_SIZE: u64 = 100;

    public struct BatchEscrow has key {
        id: UID,
        escrow_ids: Table<u64, ID>, // Maps part index to escrow ID
        parent_hash: vector<u8>,
        total_parts: u64,
        claimed_parts: u64,
        total_amount: u64,
        creator: address,
        cross_chain_id: vector<u8>,
        is_completed: bool,
    }

    // Events
    public struct BatchEscrowCreated has copy, drop {
        batch_id: ID,
        creator: address,
        total_parts: u64,
        total_amount: u64,
        parent_hash: vector<u8>,
        cross_chain_id: vector<u8>,
    }

    public struct BatchPartClaimed has copy, drop {
        batch_id: ID,
        part_index: u64,
        escrow_id: ID,
        claimer: address,
        amount: u64,
    }

    public struct BatchCompleted has copy, drop {
        batch_id: ID,
        total_claimed: u64,
        completion_percentage: u64,
    }

    // Create multiple escrows for partial fills
    public fun create_batch_escrow<T>(
        coins: vector<Coin<T>>,
        recipients: vector<address>,
        resolvers: vector<address>,
        amounts: vector<u64>,
        parent_hash: vector<u8>,
        duration_ms: u64,
        cross_chain_id: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let total_parts = vector::length(&coins);
        assert!(total_parts > 0 && total_parts <= MAX_BATCH_SIZE, EInvalidBatchSize);
        assert!(
            total_parts == vector::length(&recipients) &&
            total_parts == vector::length(&resolvers) &&
            total_parts == vector::length(&amounts),
            EMismatchedArrayLengths
        );

        let creator = sui::tx_context::sender(ctx);
        let batch = BatchEscrow {
            id: sui::object::new(ctx),
            escrow_ids: table::new(ctx),
            parent_hash,
            total_parts,
            claimed_parts: 0,
            total_amount: 0,
            creator,
            cross_chain_id,
            is_completed: false,
        };

        let batch_id = sui::object::id(&batch);
        let i = 0;

        while (i < total_parts) {
            let coin = vector::pop_back(&coins);
            let recipient = *vector::borrow(&recipients, i);
            let resolver = *vector::borrow(&resolvers, i);
            let amount = *vector::borrow(&amounts, i);

            // Verify coin amount matches expected amount
            assert!(sui::coin::value(&coin) == amount, EInvalidBatchSize);

            // Generate unique hash for this part
            let part_hash = utils::generate_partial_hash(parent_hash, i, total_parts);

            // Create individual escrow
            escrow::create_escrow(
                coin,
                recipient,
                resolver,
                part_hash,
                duration_ms,
                cross_chain_id,
                clock,
                ctx
            );

            i = i + 1;
        };

        // Destroy empty coins vector
        vector::destroy_empty(coins);

        // Emit event
        event::emit(BatchEscrowCreated {
            batch_id,
            creator,
            total_parts,
            total_amount: batch.total_amount,
            parent_hash,
            cross_chain_id,
        });

        // Share the batch object
        transfer::share_object(batch);
    }

    // Register escrow ID for a specific part (called after escrow creation)
    public fun register_escrow_part(
        batch: &BatchEscrow,
        part_index: u64,
        escrow_id: ID,
        _ctx: &mut TxContext
    ) {
        assert!(part_index < batch.total_parts, EInvalidPartIndex);
        assert!(!table::contains(&batch.escrow_ids, part_index), EPartAlreadyClaimed);

        table::add(&batch.escrow_ids, part_index, escrow_id);
    }

    // Mark a part as claimed (called when individual escrow is claimed)
    public fun mark_part_claimed(
        batch: &BatchEscrow,
        part_index: u64,
        claimer: address,
        amount: u64,
        _ctx: &mut TxContext
    ) {
        assert!(part_index < batch.total_parts, EInvalidPartIndex);
        assert!(!batch.is_completed, EBatchAlreadyCompleted);

        if (table::contains(&batch.escrow_ids, part_index)) {
            let escrow_id = *table::borrow(&batch.escrow_ids, part_index);
            
            batch.claimed_parts = batch.claimed_parts + 1;

            // Emit event
            event::emit(BatchPartClaimed {
                batch_id: sui::object::id(batch),
                part_index,
                escrow_id,
                claimer,
                amount,
            });

            // Check if batch is completed
            if (batch.claimed_parts == batch.total_parts) {
                batch.is_completed = true;
                
                event::emit(BatchCompleted {
                    batch_id: sui::object::id(batch),
                    total_claimed: batch.claimed_parts,
                    completion_percentage: 100,
                });
            }
        }
    }

    // Get batch information
    public fun get_batch_info(batch: &BatchEscrow): (
        address,
        u64,
        u64,
        u64,
        vector<u8>,
        vector<u8>,
        bool
    ) {
        (
            batch.creator,
            batch.total_parts,
            batch.claimed_parts,
            batch.total_amount,
            batch.parent_hash,
            batch.cross_chain_id,
            batch.is_completed
        )
    }

    // Get completion percentage
    public fun get_completion_percentage(batch: &BatchEscrow): u64 {
        if (batch.total_parts == 0) {
            0
        } else {
            (batch.claimed_parts * 100) / batch.total_parts
        }
    }

    // Check if specific part is claimed
    public fun is_part_claimed(batch: &BatchEscrow, part_index: u64): bool {
        part_index < batch.total_parts && 
        table::contains(&batch.escrow_ids, part_index)
    }

    // Get escrow ID for a specific part
    public fun get_part_escrow_id(batch: &BatchEscrow, part_index: u64): ID {
        assert!(part_index < batch.total_parts, EInvalidPartIndex);
        assert!(table::contains(&batch.escrow_ids, part_index), EBatchNotFound);
        *table::borrow(&batch.escrow_ids, part_index)
    }
}