### Manteia — project at-a-glance (quick summary)

| Aspect                | Key points                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mission**           | Bring 1inch Network's deep liquidity and atomic-swap engine to **Sui**, delivering a Move-native DEX with concentrated-liquidity bins, an on-chain order-book, and **bidirectional cross-chain swaps** between Sui and every 1inch-supported EVM chain.                                                                                                                                                                                                    |
| **Core pillars**      | 1. **Cross-chain Fusion+** ↔ HTLC bridge (Sui ⇄ Ethereum)<br>2. **Concentrated-liquidity AMM** (bins / ticks) built in Move **or** simulated via 1inch Limit-Orders<br>3. **Advanced order-book & strategies** (TWAP, options, stop-loss) using 1inch Limit Order Protocol predicates<br>4. **Liquidity aggregation** & best-rate routing through 1inch Aggregation API<br>5. **Dynamic, multi-tier fees** (0.01 %→1 %) with optional volatility scheduler |
| **On-chain pieces**   | • **Sui Move HTLC** (hash- + time-lock) • Sui CLMM or limit-order "bin" contracts • Governance/incentive module (LP rewards, protocol fee)                                                                                                                                                                                                                                                                                                                 |
| **Off-chain pieces**  | • **Resolver/Relayer** that listens to Sui events and 1inch Fusion+ auctions<br>• Backend that calls 1inch APIs (Fusion, Aggregation, LOP, Gas, Token, Balance)                                                                                                                                                                                                                                                                                            |
| **Front end**         | React + Vite app using Mysten Dapp Kit (Sui wallets) and web3 (EVM wallets). Shows quotes, price-impact, slippage controls, order status, portfolio.                                                                                                                                                                                                                                                                                                       |
| **Demo proof-points** | • Live Sui⇄Ethereum token swap (both on-chain TXs visible) • A tick-based pool earning fees • A TWAP or stop-loss order filled via LOP • UI dashboard                                                                                                                                                                                                                                                                                                      |

---

## Manteia — full technical blueprint

### 1 – Vision & value proposition

Manteia: a capital-efficient, non-custodial trading hub that merges **1inch's liquidity network** with Sui's high-throughput Move VM. Users gain:

* **Deeper liquidity & best prices** via 1inch Aggregation across >250 pools/DEXes.
* **Atomic, gas-less cross-chain swaps** through 1inch **Fusion+** intent auctions, now extended to Sui.
* **Concentrated-liquidity pools** (bins / ticks) giving LPs Uni v3-like fee efficiency on Sui.
* **Advanced order types** (TWAP, options, stop-loss) powered by 1inch Limit Order Protocol predicates & bit-invalidators.
* **Dynamic multi-tier fee schedule** mirroring Magma's 0.01–1 % bands with volatility boosts to offset IL.

### 2 – Functional scope mapped to 1inch & Sui

| Magma feature                         | Realisation in Manteia                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bin / tick CLMM**                   | Move CLMM contract **or** grid of 1inch limit orders at discrete prices to emulate bins; only "active bin" earns fees as orders are filled. |
| **Aggregator routing**                | 1inch Aggregation API for intra-chain swaps; UI lets traders pick "Manteia pool" vs "Best of 1inch" route.                                  |
| **Slippage & price-impact display**   | Use 1inch quote to compute price-impact; enforce user-set slippage via `minReturn` param and Move/solidity checks.                          |
| **Multi-tier & dynamic fees**         | Each Sui pool chooses tier (0 .01 %…1 %); Move module can auto-adjust within range based on 24 h σ-vol → mirrors Magma ALMM.                |
| **On-chain order-book**               | 1inch Limit Order Protocol contracts (EVM) + Move order wrapper for Sui side; predicates enable TWAP, options.                              |
| **Cross-chain atomic swap**           | 1inch Fusion HTLC on Ethereum + **Sui HTLC** Move module; shared secret hash & expiry guarantee atomicity.                                  |
| **Partial fills (stretch)**           | Leverage Fusion+ Merkle-secret fills for split executions; Move HTLC records cumulative fills.                                              |
| **Liquidity incentives & governance** | Move treasury collects 20 % proto-fee, mints MNT governance tokens; DAO votes on fee tiers, rewards.                                        |

### 3 – Architecture diagram (textual)

```
┌──────────────┐       Fusion+ order 🎯           ┌──────────────┐
│   Web DApp   │─────────────────────────────────▶│ 1inch Order  │
│ (React/Vite) │                                  │  Broadcaster │
└──────┬───────┘                                  └──────┬───────┘
       │Quote & Tx build                                │Announces intents
       │(1inch APIs)                                    │to resolvers
┌──────▼──────┐  event   ┌────────────┐   watcher   ┌───▼────────┐
│  Sui HTLC   │──────────│  Resolver  │────────────▶│ Ethereum   │
│ Move module │<─────────│/Relayer Bot│<────────────│ HTLC (Sol) │
└──────┬──────┘  secret   └────────────┘  deposit    └───┬────────┘
       │claim                                   withdraw │
┌──────▼──────┐                               ┌─────────▼────────┐
│  LP CLMM    │←──── fees, ticks  ────────────│ 1inch Aggregator │
│  on Sui     │                               │ pools & routers │
└─────────────┘                               └──────────────────┘
```

### 4 – Detailed component breakdown

1. **Sui on-chain contracts (Move)**

   * `HTLC` module – shared `SwapOffer` object with `hash`, `expiry`, `amount`, `coin`, `sender`, `receiver`; funcs `initiate`, `claim`, `cancel`.
   * `CLMM` module – maintains `Bin<T>` table keyed by tick; pools track liquidity, fee tier, volatility accumulator; `swap`, `add_liquidity`, `collect_fees`.
   * `Governance` module – `Dao` object storing fee cut %, rebate schedule; voting via MNT tokens.

2. **Ethereum / other-EVM contracts**

   * Re-use **1inch Fusion EscrowFactory**; no Solidity change.
   * 1inch Limit Order Protocol for custom predicates (e.g., time lock, oracle price) enabling TWAP/option orders.

3. **Resolver / Relayer service**

   * Listens to Fusion orderbook via `/order/active` or WebSocket; listens to Sui events with `sui-client-provider`.
   * Upon winning auction, calls EVM escrow, then interacts with Sui HTLC.
   * Observes secret reveal on one chain, unlocks on the other.
   * Maintains risk controls (safety deposits, gas price from 1inch `/gas-price`).

4. **Front-end**

   * **Wallets**: Mysten Dapp Kit hooks (`useConnectWallet`, `useSignAndExecuteTransaction`) for Sui; `ethers.js` for EVM.
   * **Swap page**: shows quote (1inch `/spot-price`, `/swap/quote`), price-impact, slippage, route breakdown.
   * **Advanced orders**: wizard to craft limit, TWAP, option orders; serializes LOP+predicate JSON for signing.
   * **History & portfolio**: 1inch `/history`, `/balance`; Sui RPC for local Move positions.

### 5 – Step-by-step build plan

| Phase                        | Tasks                                                                                                       | Deliverables                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **0. Bootstrapping**         | Install Sui CLI, launch local validator; fork 1inch Fusion solver repo; get 1inch Dev API key               | -                                          |
| **1. Smart-contract core**   | ✧ Write & test `HTLC` Move module (unit tests)<br>✧ Deploy on Sui testnet                                   | Sui escrow address                         |
| **2. Cross-chain POC**       | ✧ Deploy 1inch EscrowFactory on Sepolia<br>✧ Script: swap 1 SUI ↔ 0.01 ETH using same secret                | Two on-chain TX hashes proving atomicity   |
| **3. Relayer / resolver**    | ✧ Node service: watch Sui events, call 1inch order API, act as resolver<br>✧ Bridge secret events           | Resolver bot repo                          |
| **4. CLMM / bins**           | (A) MVP: grid of 1inch limit orders per tick<br>or (B) custom Move CLMM implementation                      | Liquidity pool on Sui; LP can add at ticks |
| **5. Front-end MVP**         | ✧ React UI: connect wallets, Swap form, Quote display, status polling                                       | Web dApp                                   |
| **6. Advanced orders**       | ✧ Integrate 1inch LOP predicates for stop-loss / TWAP<br>✧ UI to craft & sign                               | Demo order executes on predicate           |
| **7. Fee & incentive layer** | ✧ Implement multi-tier fees in CLMM; DAO treasury & MNT token mint<br>✧ Script for epochic fee distribution | Fee dashboards                             |
| **8. Stretch polish**        | ✧ Partial fills (Merkle secrets)<br>✧ UX animations, charts API, notifications                              | Final polished demo                        |

### 6 – Why it satisfies the hackathon brief

* **Extends 1inch Fusion+** to a non-EVM chain (Sui) with hashlock+timelock intact.
* Shows **on-chain execution** of assets on both chains in the live demo.
* Demonstrates **aggregation, limit orders, advanced predicates, CLMM-like liquidity**, all via 1inch tooling plus Sui Move.
* Optional UI, partial fills, and full resolver framework address stretch goals.

Manteia therefore proves that 1inch's liquidity, intent-based swapping and programmable orders can power a novel, Move-native DEX while maintaining the capital-efficient, user-friendly ethos of Magma—now on Sui.