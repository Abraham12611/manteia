module manteia::utils {
    use std::vector;
    use std::hash;
    use std::bcs;

    // Constants
    const BYTE_LENGTH: u64 = 32;
    const SECONDS_TO_MS: u64 = 1000;
    const MINUTES_TO_MS: u64 = 60000;
    const CROSS_CHAIN_BUFFER_MINUTES: u64 = 5; // 5 minute buffer for cross-chain operations

    // Error codes
    const EInvalidAddressLength: u64 = 0;
    const EInvalidHashLength: u64 = 1;

    // Generate order ID from parameters for cross-chain linking
    public fun generate_order_id(
        sender: address,
        recipient: address,
        amount: u64,
        nonce: u64
    ): vector<u8> {
        let data = vector::empty<u8>();
        vector::append(&mut data, bcs::to_bytes(&sender));
        vector::append(&mut data, bcs::to_bytes(&recipient));
        vector::append(&mut data, bcs::to_bytes(&amount));
        vector::append(&mut data, bcs::to_bytes(&nonce));

        hash::sha3_256(data)
    }

    // Generate cross-chain ID for linking Ethereum and Sui escrows
    public fun generate_cross_chain_id(
        eth_address: vector<u8>,
        sui_address: address,
        amount: u64,
        nonce: u64
    ): vector<u8> {
        assert!(vector::length(&eth_address) == 20, EInvalidAddressLength); // Ethereum address is 20 bytes

        let data = vector::empty<u8>();
        vector::append(&mut data, eth_address);
        vector::append(&mut data, bcs::to_bytes(&sui_address));
        vector::append(&mut data, bcs::to_bytes(&amount));
        vector::append(&mut data, bcs::to_bytes(&nonce));

        hash::sha3_256(data)
    }

    // Verify hash preimage (used for secret validation)
    public fun verify_preimage(
        preimage: vector<u8>,
        hash: vector<u8>
    ): bool {
        assert!(vector::length(&hash) == BYTE_LENGTH, EInvalidHashLength);
        hash::sha3_256(preimage) == hash
    }

    // Convert milliseconds to seconds (for Ethereum compatibility)
    public fun ms_to_seconds(ms: u64): u64 {
        ms / SECONDS_TO_MS
    }

    // Convert seconds to milliseconds (for Sui timestamps)
    public fun seconds_to_ms(seconds: u64): u64 {
        seconds * SECONDS_TO_MS
    }

    // Add buffer time for cross-chain delays
    public fun add_time_buffer(duration_ms: u64): u64 {
        duration_ms + (CROSS_CHAIN_BUFFER_MINUTES * MINUTES_TO_MS)
    }

    // Calculate timeout for Ethereum side (shorter than Sui side)
    public fun calculate_eth_timeout(sui_timeout_ms: u64): u64 {
        // Ethereum timeout should be 2 minutes shorter than Sui timeout
        // to ensure resolver can claim on Ethereum before Sui timeout
        if (sui_timeout_ms > (2 * MINUTES_TO_MS)) {
            ms_to_seconds(sui_timeout_ms - (2 * MINUTES_TO_MS))
        } else {
            ms_to_seconds(sui_timeout_ms / 2)
        }
    }

    // Validate secret format (must be 32 bytes for compatibility)
    public fun validate_secret(secret: vector<u8>): bool {
        vector::length(&secret) == BYTE_LENGTH
    }

    // Generate deterministic hash for partial fill support
    public fun generate_partial_hash(
        parent_hash: vector<u8>,
        part_index: u64,
        total_parts: u64
    ): vector<u8> {
        let data = vector::empty<u8>();
        vector::append(&mut data, parent_hash);
        vector::append(&mut data, bcs::to_bytes(&part_index));
        vector::append(&mut data, bcs::to_bytes(&total_parts));

        hash::sha3_256(data)
    }

    // Calculate fee amount in basis points
    public fun calculate_fee(amount: u64, fee_bps: u64): u64 {
        (amount * fee_bps) / 10000
    }

    // Create merkle proof for partial fills (simplified version)
    public fun create_merkle_leaf(
        secret: vector<u8>,
        amount: u64,
        recipient: address
    ): vector<u8> {
        let data = vector::empty<u8>();
        vector::append(&mut data, secret);
        vector::append(&mut data, bcs::to_bytes(&amount));
        vector::append(&mut data, bcs::to_bytes(&recipient));

        hash::sha3_256(data)
    }

    // Verify merkle proof (simplified - for production use a full merkle tree implementation)
    public fun verify_merkle_proof(
        leaf: vector<u8>,
        root: vector<u8>,
        proof: vector<vector<u8>>
    ): bool {
        let current_hash = leaf;
        let i = 0;
        let proof_length = vector::length(&proof);

        while (i < proof_length) {
            let proof_element = *vector::borrow(&proof, i);
            let data = vector::empty<u8>();

            // Determine order for hashing (smaller hash goes first)
            if (compare_bytes(&current_hash, &proof_element)) {
                vector::append(&mut data, current_hash);
                vector::append(&mut data, proof_element);
            } else {
                vector::append(&mut data, proof_element);
                vector::append(&mut data, current_hash);
            };

            current_hash = hash::sha3_256(data);
            i = i + 1;
        };

        current_hash == root
    }

    // Compare bytes for merkle tree ordering
    fun compare_bytes(a: &vector<u8>, b: &vector<u8>): bool {
        let a_len = vector::length(a);
        let b_len = vector::length(b);
        let min_len = if (a_len < b_len) a_len else b_len;

        let i = 0;
        while (i < min_len) {
            let a_byte = *vector::borrow(a, i);
            let b_byte = *vector::borrow(b, i);

            if (a_byte < b_byte) {
                return true
            } else if (a_byte > b_byte) {
                return false
            };
            i = i + 1;
        };

        a_len <= b_len
    }

    // Generate nonce for unique order identification
    public fun generate_nonce(ctx_bytes: vector<u8>, timestamp: u64): u64 {
        let data = vector::empty<u8>();
        vector::append(&mut data, ctx_bytes);
        vector::append(&mut data, bcs::to_bytes(&timestamp));

        let hash_bytes = hash::sha3_256(data);
        let nonce_bytes = vector::empty<u8>();

        // Take first 8 bytes for u64 nonce
        let i = 0;
        while (i < 8 && i < vector::length(&hash_bytes)) {
            vector::push_back(&mut nonce_bytes, *vector::borrow(&hash_bytes, i));
            i = i + 1;
        };

        // Convert bytes to u64 (simplified)
        if (vector::length(&nonce_bytes) == 8) {
            let result = 0u64;
            let j = 0;
            while (j < 8) {
                let byte_val = (*vector::borrow(&nonce_bytes, j) as u64);
                result = result + (byte_val << (((7 - j) * 8) as u8));
                j = j + 1;
            };
            result
        } else {
            timestamp // Fallback to timestamp
        }
    }
}