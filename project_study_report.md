# iTRUSH / CleanGKMA Project Study and Technical Walkthrough

## 1. Project overview

This project is a waste collection management web application for a Kampala city context. It is designed for different user roles:

- Resident / household user
- KCCA / municipal authority officer
- Collector / driver

The app allows residents to request waste collection, KCCA officers to assign jobs to collectors, and collectors to confirm assigned pickups. The project has a front-end prototype and an optional backend API.


## 2. What the project actually uses

### Confirmed technologies

#### HTML5
Used in all app pages. It defines the structure of the landing page, sign-in page, and dashboard screens.

#### CSS
Used for the visual design and layout. The app uses custom styling; no CSS framework is used.

#### Vanilla JavaScript
Used throughout the front-end for forms, role switching, auth, dashboard logic, notifications, and data updates.

#### Firebase
Used as the default implementation for authentication and data storage. The config is in `app/firebase-config.js`.

#### Firestore
Used as the project database in its Firebase-first approach. The app saves and reads documents such as:

- users
- collection_requests
- notifications

#### Node.js
Used for the backend API folder in `backend`.

#### Express.js
Used in the backend to expose REST API routes.

#### PostgreSQL
Used as the backend database option in the optional full-stack mode.

#### PostgreSQL driver (`pg`)
Used by Node.js to connect to PostgreSQL.

#### JWT (JSON Web Token)
Used to authenticate the user in the backend API.

#### bcryptjs
Used to hash and compare passwords.

#### LocalStorage
Used in the browser to store the JWT and some request state.

#### Browser geolocation API
Used when a resident chooses a current location for a booking.


### What is not present as a real implementation

The project does NOT currently contain a real GIS stack such as:

- Leaflet
- Google Maps JS API
- Mapbox
- OpenLayers
- PostGIS
- GeoJSON map layers
- route optimization engine

This means the project currently captures coordinates but does not yet use a proper on-map GIS workflow.


## 3. Project architecture

### Actual architecture

User
↓
Frontend web pages
↓
Firebase or Express API
↓
Database
↓
Notifications and dashboards

### Firebase-first mode

The frontend pages are static HTML files served in the browser.

Users sign in with Firebase Auth.

Firestore stores:

- user profiles
- collection requests
- notifications

The dashboards listen for updates in real time and render changes automatically.

### Backend-mode

The backend in `backend/src` starts an Express server.

The auth route handles signup and signin.

Passwords are hashed with bcryptjs.

A JWT is issued to the browser after successful login.

The PostgreSQL schema defines the structured data model.


## 4. How the information moves through the system

### When a user opens the app

The landing page loads and shows the role selection screen.

The user chooses one of:

- Resident
- KCCA
- Collector

### During registration

The sign-up page gathers user information depending on the selected role.

For example:

- Resident: first name, last name, phone, zone
- KCCA: first name, last name, department, jurisdiction, staff ID
- Collector: full name, phone, company, truck plate, zone

The app then sends the data either to Firebase or to the API backend.

### During login

The frontend sends email and password to Firebase or to `/api/auth/signin`.

The service checks the user.

If valid, the server returns a token.

The browser stores the token in localStorage and redirects the user to the role dashboard.

### Frontend-to-backend communication

In the Firebase mode, the frontend talks directly to Firebase SDKs.

In the backend mode, the browser calls fetch requests to the Express server.

Example endpoints:

- POST /api/auth/signup
- POST /api/auth/signin

### Data storage

In Firebase mode:

- `users` collection stores user profile data
- `collection_requests` stores bookings
- `notifications` stores user and role notifications

In PostgreSQL mode:

- users table stores authentication identity
- resident, collector, and kcca_officer tables store profile data
- collection_requests stores the service request lifecycle


## 5. File-by-file understanding

### `app/index.html`
This is the main landing page. It presents the project purpose and role cards for the different user categories.

### `app/signin.html`
This is the authentication page. It handles:

- login form
- signup form
- role switching
- validation
- redirect logic
- Firebase or API-based auth

### `app/resident_dashboard.html`
This is the resident dashboard. It includes:

- booking form
- location capture
- payment flow
- notifications
- profile section
- history/status views

### `app/admin_dashboard.html`
This is the KCCA operations dashboard. It includes:

- overview metrics
- assignments
- live map mock-up
- fleet data
- reports
- notifications
- assignment to collectors

### `app/driver_app.html`
This is the collector dashboard. It includes:

- assigned jobs
- confirmation workflow
- notifications
- route/trip views
- profile data

### `app/firebase-config.js`
This file holds the Firebase SDK configuration used by the front-end app.

### `backend/src/index.js`
This starts the Express API server and loads the auth route.

### `backend/src/routes/auth.js`
This file handles both signup and signin on the backend.

Important logic:

- validates user input
- hashes password
- inserts user record
- inserts role-specific profile record
- generates JWT
- returns token to client

### `backend/src/middleware/auth.js`
This file contains token verification logic.

It ensures that requests with valid JWTs are accepted and invalid tokens are rejected.

### `backend/src/db.js`
This file configures the PostgreSQL connection using the `pg` library.

### `backend/schema.sql`
This defines the relational database schema.

Tables include:

- users
- residents
- collectors
- kcca_officers
- collection_requests
- gps_logs
- notifications
- invoices
- overflow_reports


## 6. Authentication flow

### Firebase mode

1. User enters account details
2. Front-end calls Firebase Auth
3. Firebase creates or verifies the user
4. A token is generated
5. The front-end stores the token in localStorage
6. The app redirects based on role

### backend-auth mode

1. User submits login/signup data
2. Front-end sends request to Express API
3. Backend validates input
4. Password is hashed or compared
5. Token is created with JWT
6. Token is returned to browser
7. Browser saves token locally and redirects

### Important security concept

The app stores JWTs in localStorage, which is simple for a prototype but not the strongest production practice. In a real production app, developers usually consider better token storage and refresh strategies.


## 7. Project features

### Feature 1: Resident registration
Purpose: create a resident account.

Frontend: `app/signin.html`

Backend: `backend/src/routes/auth.js` (for Express mode)

Database: `users` and `residents` tables or Firestore user records

Flow:

1. User selects Resident role
2. Fills in personal details
3. Form validates the fields
4. Data is saved
5. User is redirected to resident dashboard

### Feature 2: KCCA registration
Purpose: create a municipal authority account.

Frontend: `app/signin.html`

Backend: same as above

Database: `users` and `kcca_officers`

### Feature 3: Collector registration
Purpose: create a collector/driver account.

Frontend: `app/signin.html`

Backend: same as above

Database: `users` and `collectors`

### Feature 4: Collection request creation
Purpose: resident creates a pickup request.

Frontend: `app/resident_dashboard.html`

Database: `collection_requests`

Flow:

1. Resident enters waste type, volume, date, time, address
2. Optional location is attached using geolocation
3. Booking creates a new request
4. Notification is sent to KCCA and user

### Feature 5: Payment flow
Purpose: show and confirm payment status.

Frontend: `app/resident_dashboard.html`

Database: `collection_requests` with `paymentStatus`

### Feature 6: Assignment flow
Purpose: KCCA assigns jobs to drivers.

Frontend: `app/admin_dashboard.html`

Database: `collection_requests` updated with `collectorUid` and `assignedAt`

### Feature 7: Driver confirmation
Purpose: collector confirms receipt of assignment.

Frontend: `app/driver_app.html`

Database: `collection_requests` status updates

### Feature 8: Notifications
Purpose: keep users informed about changes.

Frontend: dashboards

Database: `notifications`

### Feature 9: Dashboard views
Purpose: provide role-specific UI.

Frontend: each dashboard HTML file

### Feature 10: Operational reporting mockups
Purpose: show management data views.

Frontend: `app/admin_dashboard.html`

These are mostly design-level panels, not full backend analytics.


## 8. Database design

### PostgreSQL schema summary
The backend schema includes these tables:

- users
- residents
- collectors
- kcca_officers
- collection_requests
- gps_logs
- notifications
- invoices
- overflow_reports

### Relationship layout

users
→ residents / collectors / kcca_officers

collection_requests
→ resident_id
→ collector_id

notifications
→ user_id

invoices
→ request_id

overflow_reports
→ user_id and assigned_to officer

This is a relational model designed for a service management workflow.


## 9. API map

### Backend API routes

#### POST /api/auth/signup
Registers a new user and creates a role-based profile.

#### POST /api/auth/signin
Checks credentials and returns JWT.

#### GET /health
Returns service status for health checks.

### API responsibilities

- authenticate users
- validate request body
- create records in PostgreSQL
- return JSON responses
- enforce role-specific logic through the JWT token


## 10. Mapping and GIS analysis

### Does the project already include real maps?
No, not properly.

### What it has

- geolocation browser API
- pickup fields with latitude and longitude values
- a mock map-looking layout in the admin interface
- location-related form fields

### What it does not have

- a real map provider
- map rendering library
- markers/route polylines
- geocoding
- reverse geocoding
- GIS data storage
- PostGIS spatial analysis
- live vehicle tracking

### What the project needs for real GIS functionality

For a waste collection system, the ideal map features are:

1. Resident pickup pin on map
2. Collector route tracking
3. Service zone polygons for divisions
4. Overflow point markers
5. Real-time truck tracking
6. Service area queries by district/zone

These would need:

- Leaflet or Google Maps JS API on frontend
- coordinate storage in the database
- optional PostGIS for area queries
- backend endpoints to return map data


## 11. Missing requirements and gaps

### Already implemented

- authentication
- different role pages
- booking requests
- assignment process
- notification workflow
- role-specific dashboard interfaces

### Partially implemented

- location collection
- reporting UI
- database design
- role-based logic

### Missing

- real map integration
- on-map route display
- live GPS tracking
- spatial queries
- secure backend enforcement for every operation
- production deployment configuration
- testing and quality assurance
- full CRUD APIs for all features


## 12. How the project was likely created

### What can be confirmed

- The project is a static front-end app.
- Firebase is used for auth/data in the default mode.
- There is also an Express/PostgreSQL backend for a second implementation path.
- The user interface is designed around demo dashboards and role-based screens.

### What is inferred

This likely started as a prototype or university project built to demonstrate a service workflow UI. The UI was probably created first, then the developer added Firebase for faster authentication, and later introduced an Express/PostgreSQL backend as a more traditional full-stack alternative.


## 13. Study roadmap

### Level 1: Fundamentals
- HTML
- CSS
- JavaScript
- browser events
- DOM manipulation

### Level 2: Web app and backend basics
- front-end flow
- API calls
- localStorage
- JSON
- async programming

### Level 3: Auth and databases
- Firebase Auth
- Firestore
- PostgreSQL
- JWT
- bcryptjs

### Level 4: Project understanding
- user roles
- dashboard logic
- assignment flow
- notification flow
- collection lifecycle

### Level 5: Map/GIS
- coordinates
- geolocation
- GeoJSON
- markers
- layers
- route data
- map APIs

### Level 6: Advanced system development
- security
- validation
- testing
- deployment
- production architecture


## 14. Questions to test understanding

- What is the difference between Firebase mode and backend mode?
- What happens after a resident creates a booking?
- Which file decides which dashboard a user sees after login?
- Where is the JWT stored?
- Why is location capture not the same as GIS functionality?
- Which table or collection stores notifications?
- What is the main missing technology if this system needs real operational mapping?


## 15. Supervisor-style explanation

This is a waste collection management system built for residents, local authority staff, and collection drivers. The goal is to help a city manage pickup requests, assign those requests to collectors, and keep users informed about the status of service. The app was built as a prototype using HTML, JavaScript, and Firebase, with an optional backend using Node.js and PostgreSQL. It demonstrates a complete user workflow from login to booking to assignment and confirmation. The main limitation is that while it captures location data, it does not yet implement a full map or GIS system with geographic data, zones, route tracking, and spatial analysis. The project is therefore a solid prototype and a good foundation for a more complete operational platform.


## 16. Final conclusion

This project is a role-based waste collection prototype with a strong front-end design and a workable data model. It demonstrates the main business workflow well, but it is still a prototype rather than a fully production-ready GIS-enabled system. Its main strengths are clarity, role separation, and user workflow demonstration. Its main gaps are the lack of real GIS integration, stronger backend enforcement, and full deployment readiness.
