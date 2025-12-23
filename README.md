# AI-Powered Car Insurance Claims Platform

A functional prototype demonstrating an AI-powered claims assessment workflow for car insurance companies. Built as a take-home assignment for Scale AI's AI Product Manager position.

## Overview

This application streamlines the manual damage review and assessment process by integrating AI-powered damage detection, cost estimation, and validation into a centralized claims management system. Claims agents can manage multiple claims, upload damage photos, receive AI-generated assessments, and track approval workflows through an intuitive dashboard.

## Tech Stack

### Frontend Framework
- **React 18** (Create React App) - Component-based UI framework
- **Tailwind CSS v3** - Utility-first CSS framework for rapid styling
- **shadcn/ui** - High-quality React components (Button, Dialog, DropdownMenu)

### Backend & Database
- **Supabase** - Backend-as-a-Service providing:
  - PostgreSQL database with Row Level Security (RLS)
  - Supabase Storage for damage photo uploads
  - Real-time subscriptions (potential for future live updates)

### Database Schema
```
users - Policyholders with first_name, last_name
policies - Vehicle information (make, model, year, vin)
claims - Insurance claims with location, description, timestamps
damages - Individual damage entries with vehicle_part, description, cost, status
damage_history - Event log tracking status changes and approvals/refusals
```

## Quick Start

### Prerequisites
- Node.js 14+ and npm installed
- Git for version control

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd scale-assignment-react

# Install dependencies
npm install

# Start development server
npm start
```

The application will open at [http://localhost:3000](http://localhost:3000).

## AI Simulations & Test Cases

This prototype includes several AI simulation layers that demonstrate how production AI models would integrate:

### 1. AI Cost Estimation
**Trigger**: When uploading damage photos  
**Simulation**: Based on vehicle part selection, generates realistic repair costs:
- Front Bumper: $5,000 - $10,000
- Engine: $9,000 - $14,000  
- Rear Bumper/Windshield: $12,000 - $100,000
- Frame/Total Loss: $99,000 - $500,000

**Production Intent**: Vision models (GPT-4V, Claude Vision) would analyze damage severity, cross-reference repair databases, and estimate costs.

### 2. AI Photo Validation
**Trigger**: Upload of specific problematic images  
**Test Cases**:
- `low_light.jpg` - Detects insufficient lighting conditions
- `preexisting_damage.jpeg` - Flags signs of pre-existing damage  
- `wrong_vehicle.jpg` - Identifies VIN/vehicle mismatch

**Behavior**: Red warning boxes appear, submit button disables  
**Production Intent**: Computer vision models trained on insurance fraud patterns detect anomalies requiring human review.

### 3. AI Source Attribution
**Simulation**: Generates 1-3 mock citations for each damage assessment  
**Display**: Shows "X Sources" tag with detailed references in dialog  
**Production Intent**: Citations from repair manuals, historical claims data, and market pricing databases provide transparency and auditability.

### 4. Approval Workflow Automation
**Status Transitions**: pending → approved/refused → resubmitted  
**Test Scenarios** (in `damage_history_setup.sql`):
1. Standard approval path (created → approved)
2. Single refusal with eventual approval (unclear evidence)
3. Pending review (no action taken)
4. Overblown estimation refusal → approval after revision
5. Currently refused (insufficient documentation)  
6. Multiple refusals → final approval

**Production Intent**: AI confidence scores determine auto-approval thresholds; low-confidence cases route to human adjuster review.

**Production Intent**: AI confidence scores determine auto-approval thresholds; low-confidence cases route to human adjuster review.

## Key Features

### Claims Management Dashboard
- **Overview Metrics**: Total claims, average claim amount, damages per claim, overall approval rate
- **Expandable Claim Cards**: All claims expanded by default for quick scanning
- **Per-Claim Metrics**: Total damage amount and approval rate per claim
- **Timeline Visualization**: Color-coded event history (gray=created, green=approved, red=refused, blue=resubmitted)

### Damage Assessment Workflow
- **Multi-Photo Upload**: Drag-and-drop interface for damage documentation
- **AI Cost Estimation**: Real-time cost prediction based on damage type
- **Status Badges**: Visual indicators (pending/approved/refused/resubmitted)
- **Source Citations**: Transparency into AI decision-making process

### Quality Control & Validation
- **Photo Quality Checks**: Detects low-light, blur, wrong vehicle
- **Edit Functionality**: Refused damages can be revised and resubmitted
- **Approval History**: Complete audit trail of all status changes
- **Manual Override**: Claims agents can adjust AI estimates

## Architecture Decisions

### Human-AI Interaction Model
1. **Agent Initiates**: Claims agent creates claim and uploads photos
2. **AI Assists**: System provides cost estimates and quality checks
3. **Agent Reviews**: Human verifies AI assessment, adjusts if needed
4. **AI Flags**: Problematic photos prevent submission until resolved
5. **Adjuster Approves**: Final human approval with refusal feedback loop

### State Management
- React useState/useEffect for local state
- Supabase for persistent storage
- Photo validation state prevents bad data entry

### Data Flow
```
User Upload → Supabase Storage → AI Analysis → Local State Update → 
UI Feedback → User Confirmation → Database Persistence
```

## Testing Instructions

### Manual Test Scenarios

**Test 1: Standard Claim Flow**
1. Click "New Claim" 
2. Fill in policy details
3. Click "Add Damage" on created claim
4. Select "Front Bumper", add description
5. Upload any photo
6. Observe AI cost estimate and sources
7. Submit and verify status badge shows "pending"

**Test 2: Photo Validation**
1. Add damage to any claim
2. Upload file named `low_light.jpg`
3. Observe red warning box appears
4. Note submit button is disabled
5. Remove photo → warning clears, button re-enables

**Test 3: Refusal & Resubmission**
1. Find a damage with "refused" status (orange badge)
2. Click pencil icon to edit
3. Modify description or cost
4. Submit → observe status changes to "resubmitted" (blue badge)
5. Check timeline dialog to see event history

**Test 4: Timeline Visualization**
1. Click "Timeline" button on any damage
2. Observe chronological event list with color coding
3. Read refusal reasons and comments
4. Verify timestamps are in descending order

## Database Setup

The application connects to a pre-configured Supabase instance. For local development or production deployment:

1. Create Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL schema from `damage_history_setup.sql`
3. Configure RLS policies for appropriate access control
4. Update Supabase credentials in `src/App.js`
5. Create storage bucket named `damage-photos` with public read access

## Future Enhancements

While out of scope for this prototype, production considerations include:

- **Real AI Integration**: GPT-4V/Claude Vision for actual damage analysis
- **Fraud Detection**: ML models trained on fraud patterns
- **Automated Routing**: Rules engine for claim assignment
- **Mobile App**: Native iOS/Android for field agents
- **PDF Generation**: Formal estimates and reports
- **Integration APIs**: Connection to repair shops, OEM databases
- **Advanced Analytics**: Predictive models for settlement costs
- **Multi-Language**: i18n support for global operations

## Performance Considerations

- Photo uploads are chunked for large files
- Lazy loading for damage lists on large claims
- Indexed database queries on claim_id and status
- Optimistic UI updates before database confirmation

## License

This project was created as a take-home assignment for Scale AI. All rights reserved.

---

**Built with AI assistance using GitHub Copilot and Claude**  
**Time Investment: ~4 hours**  
**Completion Date: December 2025**

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
