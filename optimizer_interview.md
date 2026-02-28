# Fleet Optimizer — Design Interview Notes

## Source: BetterHelp Optimizer (Darcy's prior work)

### Architecture
- **Solver:** Mixed-Integer Programming (MIP)
- **Objective function:** Single numerical function (minimization) that encodes competing goals as terms in a large linear algebra equation
- **Trade-offs:** Baked into coefficients, not separate objectives

### Weight System
- **Match Quality Score (MQS):** Logistic regression (possibly paired w/ XGBoost)
- **Y variable:** `bad_outcome` = 1 if paying client switched therapist OR quit/refunded within 14 days of converting
- **Lower coefficients = better** (minimizing bad outcomes)
- Each term below marked ** had its own coefficient in the MQS model

### Objective Function Terms

| # | Term | Type | Details |
|---|------|------|---------|
| 1 | **Match Quality Score weights** | Meta | LR coefficients on all ** terms below are the weights |
| 2 | **One-sided matching vars** | Soft preference | Client asks for something, therapist has no explicit toggle (e.g., female_therapist). Encoded 0/1. ** |
| 3 | **Two-sided matching vars** | Strong preference | Client asks + therapist toggles on/off. Key categories: LGBTQ, therapist of color, religious, etc. Goal: maximize matched pairs. Multi-site system (teencounseling, faithfulcounseling, regain). ** |
| 4 | Eligibility matrix | Hard constraint | Giant binary matrix: can client_i be matched to therapist_j given telemedicine laws. Not a scored term — pass/fail. |
| 5 | Demand forecasting system | Supply protection | Time series on rolling window estimating hourly demand per therapist type. Hyperparameters prevent over-allocation of scarce therapist types (e.g., don't exhaust therapists of color on clients who didn't request one). Own weights. |
| 6 | **Therapist Quality Score** | Quality signal | Percentile encoded 0-1, higher = better. Fed into MQS model as a feature with its own LR coefficient. ** |
| 7 | **Goldilocks model** | Caseload pacing | Causal model preventing therapists from accelerating caseload beyond proven quality. Based on therapist capacity. Own weights. ** |

### Constraints (Hard)
- Therapist must be accepting new clients (boolean)
- Therapist self-set capacity limit (e.g., "max 3 new clients in 24h")
- Telemedicine eligibility matrix (legal compliance)

### Key Design Insights
- Batch matching ran **hourly**
- Single objective function but encodes ~6 competing goals via LR coefficients
- Demand system is forward-looking (prevents greedy depletion of scarce supply)
- Goldilocks model is a guardrail (quality gate on growth)

---

## Fleet Optimizer Translation

| BetterHelp Concept | Fleet Equivalent | Hackathon Implementation |
|-------------------|-----------------|------------------------|
| Match Quality Score (LR) | Ride-Vehicle Fit Score | Weighted sum: proximity + capacity_fit + time_window_fit + vehicle_type_match |
| One-sided matching vars | Rider soft preferences | "prefers SUV", "needs wheelchair accessible" — rider asks, not all vehicles have it |
| Two-sided matching vars | Vehicle capability match | Vehicle has luggage_capacity, vehicle_type; ride has service_type, luggage_count. Both sides specified. |
| Eligibility matrix | Hard feasibility filter | Can this vehicle physically do this ride? (capacity >= passengers, type matches, time window reachable) |
| Demand forecasting | *(skip for hackathon)* | Could mention in pitch as "production would add demand forecasting to prevent fleet exhaustion" |
| Therapist Quality Score | Driver reliability score | Simulated 0-1 score per driver. Higher = more reliable/experienced. |
| Goldilocks model | Driver fatigue / shift pacing | Don't overload a single driver. Penalize assigning 4th+ ride to same vehicle when others have capacity. |
| Capacity constraint | Vehicle availability | is_available boolean + max rides per shift |
| Batch matching (hourly) | Batch optimization (on-demand button for demo) | Production would run on interval |

### Proposed Hackathon Objective Function
```
minimize SUM over all assignments:
  w1 * deadhead_distance(vehicle_location → pickup)
  + w2 * (1 - capacity_fit_score)      # penalize poor capacity utilization
  + w3 * (1 - type_match_score)        # penalize vehicle type mismatch
  + w4 * time_window_violation_penalty  # hard-ish: late pickups are expensive
  + w5 * load_imbalance_penalty         # Goldilocks: spread work across fleet
  - w6 * driver_quality_score           # prefer better drivers for priority rides
  + w7 * priority_delay_penalty         # VIP rides penalized more for delays
```

### Proposed Constraints (Hard)
- Vehicle capacity >= ride passenger count
- Vehicle must be available (not mid-ride)
- Pickup must be reachable within time window
- Vehicle type must be compatible with service type

---

## Open Questions
- ~~How were MQS weights determined?~~ LR coefficients from bad_outcome model
- ~~What made MIP necessary vs simpler greedy?~~ See below
- For hackathon: greedy with reservation heuristic is sufficient (see translation)

## Why Greedy (FCFS) Failed at BetterHelp

### The core problem: heterogeneous constrained markets with scarce supply

1. **52 marketplaces, not one.** Telemedicine laws created state-level markets with different supply/demand curves. Some states had tiny therapist pools.

2. **Eligibility was a complex graph, not a simple filter:**
   - Base case: in-state licensure only (therapist licensed in OR → OR clients only)
   - Pandemic expansion: interstate matching if BOTH client's state AND therapist's state allow out-of-state therapy
   - Therapists can hold licenses in multiple states (expands their eligible client pool)
   - International clients: therapist must opt-in

3. **The FCFS depletion problem (why greedy fails):**
   - High-quality therapist of color in Tennessee (small market, few such therapists)
   - Greedy assigns her to clients who DIDN'T ask for a therapist of color — because she's high quality and the quality score is heavily weighted
   - Later, a client comes in who specifically WANTS a therapist of color in TN
   - No supply left → bad match → bad_outcome = 1
   - MIP + demand forecasting solves this by "reserving" scarce supply for future demand that specifically needs it

4. **The old greedy system:** Engineering-designed points system with arbitrary weights tuned over ~8 years. Had robust fallback/tiebreaking logic. But couldn't reason about future demand or cross-market scarcity.

### Fleet translation of this insight

| BetterHelp Problem | Fleet Equivalent |
|-------------------|-----------------|
| Scarce therapist types in small state markets | Specialized vehicles (wheelchair-accessible, luxury sedan, sprinter van) in limited supply |
| Greedy depletes TOC on non-requesting clients | Greedy assigns the luxury sedan to a basic airport run because it's closest, then the VIP corporate booking has no luxury vehicle |
| Demand forecasting prevents depletion | Reserve specialized vehicles for rides that NEED them, even if they're a good fit for generic rides |
| 52 heterogeneous marketplaces | Service zones / time windows create sub-markets (airport corridor, downtown, suburbs) |

### Hackathon implementation (simplified)
For 10 rides / 3 vehicles, full MIP is overkill. Instead:
1. **Hard filter:** eliminate infeasible pairs (capacity, type, time window)
2. **Scored assignment with reservation logic:**
   - Score all feasible vehicle-ride pairs using weighted sum
   - BUT: if a vehicle has a specialized capability (e.g., high capacity, luxury type), 
     and there are rides in the queue that REQUIRE that capability, 
     penalize assigning that vehicle to rides that DON'T require it
   - This is the "demand-aware" heuristic — cheap approximation of the MIP insight
3. **Greedy assign** from highest-score pair downward
4. **Claude narrates** the trade-offs, especially the reservation logic ("I held Vehicle 3 
   for Ride 7 because it's the only SUV and Ride 7 needs luggage capacity for 6")

This gives us the *story* of the BetterHelp insight without needing PuLP/CBC.