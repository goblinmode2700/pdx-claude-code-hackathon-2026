# Greenline (FleetMancer B) -- Domain Context Summary

Extracted from `/Users/darcyrose/VSCodeProjects/greenline/docs/` and `CLAUDE.md`.
This is a reference for understanding the domain, not a spec to implement against.

---

## 1. What It Is

- **FleetMancer B** (codename "Greenline") is a ground-up reimplementation of **LimoAnywhere (LA)**, a B2B SaaS platform for small-to-midsize ground transportation operators (limo companies, black car services, shuttle operators, chauffeur fleets running 5-50 vehicles)
- Core user: operations manager or owner-operator juggling reservation intake, vehicle/driver scheduling, real-time dispatch, and financial settlement
- Daily workflow loop: take booking -> assign driver/vehicle -> dispatch -> track trip -> settle payment -> invoice customer

---

## 2. Domain Model Definitions

### Reservation (central entity, 41+ DTOs in LA)
- Core fields: `id`, `confirmation_number`, `state`, `payment_status`, `is_draft`, `reservation_type`, `total_amount`, `farm_out_amount`, `farm_in_amount`, `scheduled_pickup_at`, `scheduled_dropoff_at`
- Extended fields: passenger_count, luggage_count, child_seat_info, po_client_ref, voucher_number, spot_time, metadata (JSONB)
- Reservation types: `in_house`, `farm_in`, `farm_out`
- Three independent charge sets: primary (customer charge), farm_out (pay to affiliate), farm_in (affiliate pays you)
- Relationships: Account (billing + passenger), Driver, Vehicle, ServiceType, VehicleType, ReservationGroup, has many TripLocations, has many Charges
- Supports copy, round-trip creation, and group linking

### Account (customer/contact)
- Base entity representing a person
- Composable roles via AccountRole: `billing_contact`, `booking_contact`, `passenger` (not boolean flags)
- Optional parent Company for B2B relationships
- Financial defaults: payment method, payment terms, agent assignment with commission
- Per-account rate matrix assignment for corporate billing

### Driver
- Fields: name, employment_type (`full_time`, `part_time`, `contractor`, `sub_contractor`), level (0-3), pay rates (regular/overtime/double-time hourly + travel time), VIP flag
- Default vehicle assignment, driver group membership
- `do_not_send_notifications` opt-out flag
- Pay tracked via DriverPayrollEntry (hours x rates per reservation)

### Vehicle (Car)
- Fields: make, model, year, license_plate, code, color, vehicle_type_id, is_active
- Vehicle code is a short dispatch identifier (e.g., "SUV-01")
- Belongs to VehicleType, optionally assigned to Driver as default

### VehicleType
- Fields: name, code, passenger_capacity, luggage_capacity, is_active, is_visible, is_handicap_accessible
- Codes: SUV, SP-LIMO, SPRINTER, etc.
- Visibility controls customer-facing display vs. internal availability
- Capacity validated against reservation passenger count

### TripLocation (ordered collection on Reservation)
- Location types: `address`, `airport`, `seaport`, `poi`, `hotel`
- Actions: `pickup`, `dropoff`, `stop`, `wait`
- Every reservation requires min 1 pickup + 1 dropoff
- Airport locations carry flight info (airline, flight number, arrival time)
- Order number defines route sequence
- Optional zone_id for zone-based pricing

### Charge
- Fields: charge_set (primary/farm_out/farm_in), rate_type, rate_group, unit_value, unit_count, total_value, is_primary
- Rate types: `fixed` (flat), `multiplier` (value x count), `percentage` (base x value/100)
- Rate groups: base_rate, miscellaneous, gratuities, taxes, surcharge1-4, discount1-2
- All arithmetic uses Decimal (no floating-point)

### Invoice
- Groups multiple completed reservations for a billing contact
- Fields: invoice_number, total_amount, paid_amount, is_paid, is_closed, terms, discount_amount
- Has many Payments, M:N with Reservations
- Lifecycle: draft -> finalized -> sent -> paid/closed

### Payment (record-only for v1)
- Fields: amount, method, received_at, recorded_by
- No payment processor integration in v1 -- operators manually log payments
- Payment status on reservations: unpaid -> partial -> paid

### ServiceType
- Configurable entity: Transfer, Hourly, Airport Arrival/Departure, Point-to-Point
- Determines which rate table and charge structure applies

### Company (tenant entity)
- B2B client companies with negotiated rates and billing terms
- Every domain entity has `company_id` FK (via CompanyMixin) for multi-tenancy
- Single tenant per deployment in v1, but schema is multi-tenant-ready

### ReservationGroup
- Types: `round_trip`, `multi_leg`
- Loose grouping -- linked reservations display together in dispatch and can be invoiced together

### Agent
- External referral source (travel agency, hotel concierge, corporate travel manager)
- Commission structure: flat_fee, percentage_base, percentage_total
- Commission auto-calculated on settlement

### Affiliate
- External operator for farm-in/farm-out trips
- Separate settlement workflow

### Zone / ZoneRate
- Geographic zones with fixed prices between zone pairs
- Per vehicle type, optional per service type
- Zone pricing overrides standard rate table (does not supplement)

---

## 3. Business Logic Rules

### Reservation State Machine
- Linear happy path: `unassigned -> assigned -> driver_en_route_to_pickup -> driver_is_at_pickup -> in_progress -> done`
- Escape hatches: `cancelled` and `no_show` valid from any non-terminal state
- `unassign` (back to `unassigned`) valid from `assigned` only
- Terminal states: `done`, `cancelled`, `no_show` (no outgoing transitions)
- Implemented as a data structure (dict of valid transitions), not if/else chains
- Enforced at service layer; routers expose dedicated action endpoints (POST `/reservations/{id}/assign`, etc.)
- Each transition records a timestamp (assigned_at, en_route_at, arrived_at, picked_up_at, dropped_off_at, cancelled_at, no_show_at)
- Cancel/no-show require a reason (predefined options + free text)

### Draft Reservations
- `is_draft` boolean on Reservation model
- Saving without all required fields (or explicit "Save as Draft") sets `is_draft=true`
- "Unfinalized" tab filters for `is_draft=true`

### Dispatch Rules
- Grid is date-scoped (view one day at a time)
- Configurable column visibility with per-user saved presets
- Column presets: "Driver View", "Billing View", "Airport View"
- Assignment conflict detection: driver/vehicle overlap query with configurable buffer minutes
- Conflict produces 409 error with force_override option
- Operational flags: child seat, VIP, rush, outstanding balance
- Status progression through dispatch: Unassigned -> Dispatched -> En Route -> Arrived -> In Car -> Done
- SSE (Server-Sent Events) for real-time dispatch updates

### Pricing / Rate Engine
- Zone lookup-then-fallback: check zone pair (pickup -> dropoff) first, if found use fixed zone price as base rate; if no zone match, fall back to standard rate table
- Zones override rate tables for base rate; surcharges/taxes/gratuity/discounts still apply on top
- Rate calculation: pure function, Decimal arithmetic, no side effects
- Rate versioning: historical reservations preserve original rate at booking time
- Rate matrices: named rate tables per company, account-to-matrix assignment, 3-tier resolution (account -> company default -> manual)
- Rule-based fees: condition sets (service type, zone, date range) with effects (add fixed, multiply, add percentage)
- Manual override preserved: operator can override any calculated charge, flagged visually and logged
- Charge formula: Base Rate + hourly + extra stops + surcharges (STC, Fuel, Taxes as %) + gratuity - discounts = Grand Total

### Wait Time / Grace Periods
- Per-vehicle-type per-minute wait time rates
- Grace period tiers: Non-airport, Airport Domestic, Airport International
- Auto-computed from pickup arrival to departure timestamps

### Settlement Workflow
- Sequential for customer billing: trip done -> settle (record payment) -> receivables (group into invoice)
- Driver payroll is independent parallel track (drivers paid based on completed trips regardless of customer payment)
- Two-step process: PMTS (record payment) then SETTLE (mark complete)
- Batch settlement supported
- Agent commission auto-calculated after settling

### Invoicing
- Groups settled trips by billing contact/company
- Payment terms inherited from customer account (Due Upon Receipt through Net 1 Year)
- Supports partial payments, credit memos, aging (30/60/90+)
- PDF generation, email sending

### Driver Payroll
- Trip-based with hourly pay rates (regular, overtime, double time) + travel time
- Status-to-time pipeline: timestamps on state transitions feed payroll hour calculation
- Batch mark-paid supported

### Farm-in / Farm-out
- Three independent charge collections: Primary (customer), Farm-out (pay affiliate), Farm-in (affiliate pays you)
- Margin = total_amount - farm_out_amount
- Farm-in/farm-out type determines cost structure and which cost tab is active

### Attribution
- `arranged_by`: operational attribution (who booked on behalf -- travel agent, concierge)
- `source`: marketing attribution (how customer found operator)
- Both are operator-configurable lookup lists

### Notifications
- Confirmation emails on reservation creation/update
- Driver notifications on assignment (respects per-driver opt-out)
- Scheduled reminders: automated reminders to passengers/drivers ahead of trips
- Automation rollback: cancel stale reminders when data changes

### RBAC (v1)
- Three roles: `operator` (full access), `dispatcher` (operational, no financial), `agent` (booking, no settlement/payroll)
- Role stored on user-company association (not on user)
- Enforced at router level via `require_role()` dependency
- Services trust router authorization

---

## 4. Optimization-Related Logic and Constraints

### Conflict Detection
- ConflictDetectionService checks driver + vehicle overlap for assignments
- Configurable buffer minutes between trips
- Terminal states excluded from overlap checks
- Company setting to enable/disable conflict detection
- 409 on conflict, `force_override` bypass available

### Query Performance Constraints
- All list endpoints paginated: 0-based, limit/offset, max limit 100
- Invalid sort/filter params return 400 (never 500, never silent failure)
- SQLAlchemy selectinload/joinedload for all relationship loading (no lazy loading in async context)
- Every list endpoint uses a single query with explicit joins (no N+1)
- No caching in v1 -- queries must be correct first
- company_id indexed on every entity for tenant-scoped queries

### Filter Engine
- FilterCondition/FilterGroup Pydantic schemas
- 12 operators, recursive AND/OR, max depth 5
- JSONB column on ReminderRule for rule-based filtering

### Scalability Design Points
- Backend is stateless -- all persistent state in Postgres
- Frontend is stateless -- all server state in TanStack Query cache
- company_id on every entity makes multi-tenancy a query-scoping change (not schema change)
- Feature flags: company-scoped toggles with in-memory cache (60s TTL)
- Worker service for background jobs (reminders, bulk email)

---

## 5. API Patterns and Data Flow Architecture

### Three-Tier Architecture
```
React SPA (Vite + shadcn) -> HTTP/JSON -> FastAPI (Python 3.13) -> SQL (async) -> Postgres 16
```

### Backend Layers
- **Router** (app/api/): thin, validates input (Pydantic), calls service, catches domain exceptions -> HTTP codes, returns Pydantic response. NEVER contains business logic
- **Service** (app/services/): ALL business logic, inherits BaseService, receives db session + settings via DI, raises domain exceptions (never HTTP), returns Pydantic Read schemas
- **Database** (app/db/): SQLAlchemy async ORM models, Alembic migrations, session injected via FastAPI dependency

### API Conventions
- All routes prefixed `/api/v1`
- REST naming: plural nouns, kebab-case
- State transitions are explicit action endpoints: `POST /reservations/{id}/assign`
- Error response: `{ detail, error_code, field_errors }`
- Error codes: uppercase snake_case (RESERVATION_NOT_FOUND, INVALID_STATE_TRANSITION)
- Pagination: `{ items, total_count, limit, offset }` -- 0-based, limit default 20, max 100
- Filtering: explicit named query params, multi-value via repeated params
- Invalid params return 400 with allowed values (never 500, never silent empty)

### Frontend Data Flow
```
Page Component -> Custom Hook (TanStack Query) -> API Client (axios) -> Backend API
```
- Pages are thin (compose hooks and components)
- One hook per domain entity
- API clients in services/ (raw axios calls)
- Types in types/ mirror backend Pydantic schemas
- `any` is banned; all API shapes have named interfaces
- Server state: TanStack Query only
- Local UI state: useState/useReducer only
- No global client state manager

### Auth Flow
- Neon Auth (managed Better Auth service) handles all auth
- Frontend: @neondatabase/auth SDK for sign-in/sign-up/session/Google OAuth
- Backend: JWT validation via JWKS endpoint, extracts user_id from sub claim
- company_id resolved by looking up user-company association (not in JWT)
- Every service method receives and scopes by company_id
- 401 interceptor redirects to sign-in; 403 shows toast

### Dependency Injection Pattern
- FastAPI Depends() wires everything: db session, settings, services
- Services instantiated per-request, never own their db session
- Constructor injection: `class ReservationService(BaseService): def __init__(self, db, settings)`

### Exception Pattern
- Domain exceptions in app/exceptions.py (ReservationNotFound, InvalidStateTransition, DriverConflict, etc.)
- DomainException base with status_code + detail
- Global exception handler maps to HTTP responses
- Services raise, routers handle

### Testing Strategy
- Backend: pytest + httpx async, real Postgres (never SQLite), 80% coverage gate
- Frontend: Vitest + React Testing Library, Playwright for E2E
- CI: lint -> type-check -> test (fail-fast)
- Test files mirror source structure

### Infrastructure
- Local: Docker Compose (Postgres + backend + frontend)
- Production: GCP Cloud Run (containerized), Neon (serverless Postgres), Doppler (secrets)
- IaC: Terraform (write only, never apply without human)
- Secrets: Doppler injects at runtime; .env.example is source of truth for required vars

---

## 6. Key Enums Reference

- **ReservationState**: unassigned, assigned, driver_en_route_to_pickup, driver_is_at_pickup, in_progress, done, cancelled, no_show
- **PaymentStatus**: unpaid, paid, partially_paid, overpaid
- **ReservationType**: in_house, farm_in, farm_out
- **LocationType**: address, airport, seaport, poi, hotel
- **LocationAction**: pickup, dropoff, stop, wait
- **RateType**: fixed, multiplier, percentage
- **RateGroup**: base_rate, miscellaneous, gratuities, taxes, surcharge1-4, discount1-2
- **ChargeSet**: primary, farm_out, farm_in
- **EmploymentType**: full_time, part_time, contractor, sub_contractor
- **AccountRole**: billing_contact, booking_contact, passenger
- **UserRole**: operator, dispatcher, agent
- **CommissionType**: flat_fee, percentage_base, percentage_total
- **GroupType**: round_trip, multi_leg

---

## 7. Known Development Patterns / Anti-Patterns

From `docs/DEVELOPMENT_PATTERNS.md` (7 documented failure patterns from production):

1. **Mock Boundary Blindness**: Frontend service URLs must match backend router paths exactly -- mocks don't validate URL strings
2. **Cross-Layer Contract Drift**: Enums/filters/data shapes added to one layer but not the other
3. **Wiring Stops Halfway**: UI built but not connected to backend (no-op handlers, missing routes)
4. **Empty States Masquerade as Success**: Failed API calls look identical to "no data" pages
5. **Data Resolution Deferred**: Foreign key UUIDs displayed instead of human-readable names
6. **Seed and Init State Assumptions**: Code depends on DB state that was never seeded
7. **Error Path Neglect**: Mutation hooks without onError callbacks = silent failures

Meta-pattern: a green test suite is necessary but not sufficient. Manual verification against running backend required.
