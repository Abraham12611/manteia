module manteia::resolver {
    use sui::object::{UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::table::{Self, Table};
    use sui::event;

    // Error codes
    const ENotAdmin: u64 = 0;
    const EResolverAlreadyExists: u64 = 1;
    const EResolverNotFound: u64 = 2;
    const EInvalidFee: u64 = 3;
    const EResolverNotActive: u64 = 4;

    // Constants
    const MAX_FEE_BPS: u64 = 1000; // 10% max fee

    // Resolver registry
    struct ResolverRegistry has key {
        id: UID,
        resolvers: Table<address, ResolverInfo>,
        admin: address,
        total_resolvers: u64,
    }

    struct ResolverInfo has store {
        name: vector<u8>,
        fee_bps: u64, // Basis points (100 = 1%)
        is_active: bool,
        total_volume: u64,
        successful_swaps: u64,
        failed_swaps: u64,
        reputation_score: u64, // Out of 100
        last_activity: u64,
    }

    // Events
    struct ResolverRegistered has copy, drop {
        resolver: address,
        name: vector<u8>,
        fee_bps: u64,
    }

    struct ResolverUpdated has copy, drop {
        resolver: address,
        is_active: bool,
        fee_bps: u64,
    }

    struct ResolverStatsUpdated has copy, drop {
        resolver: address,
        total_volume: u64,
        successful_swaps: u64,
        reputation_score: u64,
    }

    // Initialize registry (one-time)
    fun init(ctx: &mut TxContext) {
        let registry = ResolverRegistry {
            id: sui::object::new(ctx),
            resolvers: table::new(ctx),
            admin: tx_context::sender(ctx),
            total_resolvers: 0,
        };
        transfer::share_object(registry);
    }

    // Register a new resolver
    public fun register_resolver(
        registry: &mut ResolverRegistry,
        resolver: address,
        name: vector<u8>,
        fee_bps: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == registry.admin, ENotAdmin);
        assert!(!table::contains(&registry.resolvers, resolver), EResolverAlreadyExists);
        assert!(fee_bps <= MAX_FEE_BPS, EInvalidFee);

        let info = ResolverInfo {
            name,
            fee_bps,
            is_active: true,
            total_volume: 0,
            successful_swaps: 0,
            failed_swaps: 0,
            reputation_score: 50, // Start with neutral score
            last_activity: 0,
        };

        table::add(&mut registry.resolvers, resolver, info);
        registry.total_resolvers = registry.total_resolvers + 1;

        event::emit(ResolverRegistered {
            resolver,
            name,
            fee_bps,
        });
    }

    // Update resolver status and fee
    public fun update_resolver(
        registry: &mut ResolverRegistry,
        resolver: address,
        is_active: bool,
        fee_bps: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == registry.admin, ENotAdmin);
        assert!(table::contains(&registry.resolvers, resolver), EResolverNotFound);
        assert!(fee_bps <= MAX_FEE_BPS, EInvalidFee);

        let info = table::borrow_mut(&mut registry.resolvers, resolver);
        info.is_active = is_active;
        info.fee_bps = fee_bps;

        event::emit(ResolverUpdated {
            resolver,
            is_active,
            fee_bps,
        });
    }

    // Update resolver stats (called after swap completion)
    public fun update_resolver_stats(
        registry: &mut ResolverRegistry,
        resolver: address,
        volume: u64,
        success: bool,
        timestamp: u64,
        _ctx: &mut TxContext
    ) {
        if (table::contains(&registry.resolvers, resolver)) {
            let info = table::borrow_mut(&mut registry.resolvers, resolver);
            info.total_volume = info.total_volume + volume;
            info.last_activity = timestamp;

            if (success) {
                info.successful_swaps = info.successful_swaps + 1;
            } else {
                info.failed_swaps = info.failed_swaps + 1;
            };

            // Update reputation score based on success rate
            let total_swaps = info.successful_swaps + info.failed_swaps;
            if (total_swaps > 0) {
                info.reputation_score = (info.successful_swaps * 100) / total_swaps;
            };

            event::emit(ResolverStatsUpdated {
                resolver,
                total_volume: info.total_volume,
                successful_swaps: info.successful_swaps,
                reputation_score: info.reputation_score,
            });
        }
    }

    // Self-update by resolver (limited fields)
    public fun resolver_self_update(
        registry: &mut ResolverRegistry,
        fee_bps: u64,
        ctx: &mut TxContext
    ) {
        let resolver = tx_context::sender(ctx);
        assert!(table::contains(&registry.resolvers, resolver), EResolverNotFound);
        assert!(fee_bps <= MAX_FEE_BPS, EInvalidFee);

        let info = table::borrow_mut(&mut registry.resolvers, resolver);
        info.fee_bps = fee_bps;

        event::emit(ResolverUpdated {
            resolver,
            is_active: info.is_active,
            fee_bps,
        });
    }

    // Check if resolver is active and get info
    public fun get_resolver_info(
        registry: &ResolverRegistry,
        resolver: address
    ): (bool, u64, u64, u64) {
        if (table::contains(&registry.resolvers, resolver)) {
            let info = table::borrow(&registry.resolvers, resolver);
            (info.is_active, info.fee_bps, info.reputation_score, info.total_volume)
        } else {
            (false, 0, 0, 0)
        }
    }

    // Check if resolver is active
    public fun is_resolver_active(
        registry: &ResolverRegistry,
        resolver: address
    ): bool {
        if (table::contains(&registry.resolvers, resolver)) {
            let info = table::borrow(&registry.resolvers, resolver);
            info.is_active
        } else {
            false
        }
    }

    // Get resolver fee
    public fun get_resolver_fee(
        registry: &ResolverRegistry,
        resolver: address
    ): u64 {
        assert!(table::contains(&registry.resolvers, resolver), EResolverNotFound);
        let info = table::borrow(&registry.resolvers, resolver);
        assert!(info.is_active, EResolverNotActive);
        info.fee_bps
    }

    // Get registry stats
    public fun get_registry_stats(registry: &ResolverRegistry): (u64, address) {
        (registry.total_resolvers, registry.admin)
    }

    // Transfer admin (emergency function)
    public fun transfer_admin(
        registry: &mut ResolverRegistry,
        new_admin: address,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == registry.admin, ENotAdmin);
        registry.admin = new_admin;
    }
}