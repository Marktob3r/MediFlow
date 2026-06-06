# Project title: MediFlow: A Cloud-Based Patient Throughput Solution with A.I. Analysis for Samuel P. Dizon Medical Clinic.

## Team Composition:

1. Mark Christian Gabriel - Frontend & Backend
2. John Rayniel Bonifacio - Documentation

## Target Beneficiary:  
Samuel P. Dizon Medical Clinic Staffs & Patients 

 
## Problem Scenario (The Pain Point)
The clinic's current operations are hindered by a reliance on paper-based records and physical, unpredictable waiting rooms. Because the clinic operates on a first-come, first-serve basis without digital tracking, patients frequently experience extended, unquantifiable wait times in crowded areas, leading to frustration and heightened stress. These manual workflows become particularly burdensome during peak hours, creating administrative bottlenecks at the front desk. Furthermore, without a transparent method for patients to monitor their place in line or submit preliminary symptoms before consultation, the triage and intake processes remain manually intensive, inefficient, and prone to communication gaps.

## Proposed Solution
The proposed system transforms the traditional waiting room into a transparent, digital queueing experience. Patients can join the daily queue remotely via a web portal, submit digital intake forms, and monitor their real-time place in line from any device. To optimize patient flow and reduce physical congestion, an automated notification system utilizes web push and email alerts to notify patients precisely when their turn is approaching. Furthermore, the system equips clinic staff with a unified dashboard to manage walk-ins, prioritize urgent cases through a triage override, and securely update Electronic Medical Records (EMR). Finally, administrators are provided with data-driven insights into daily operations, such as average wait times and patient volume, to continuously refine clinic efficiency.

 
## Tech Stack: 
Frontend/Mobile: React 
Backend: Node.js
Database: Supabase 

 
## UN SDG Alignment: 
SDG 3: Good Health & Well Being 
SDG 8: Decent Work and Economic Growth 
SDG 9: Industry, Innovation & Infrastructure 


## Features:

1. Automated Web Push:
For sending real-time alerts confirming a patient's spot in line and notifying them when their turn is immediately approaching, reducing physical waiting room congestion.

2. Live Digital Queueing Engine:
The core portal allowing patients to securely join the daily first-come, first-serve roster remotely. It includes a real-time monitor displaying active queue metrics (e.g., "Currently Serving," "People Ahead").

3. Patient Portal with Digital Intake Forms:
A dedicated dashboard for patients to manage their profiles, view past medical histories, and submit pre-consultation symptom reports (chief complaints) to accelerate the doctor's intake process.

4. Unified Staff & Admin Dashboard with Walk-In Support:
A control center for managing live operations. Staff can efficiently call, serve, or skip patients, and manually register non-app walk-ins at the front desk. Administrators have elevated access to open/close the daily queue and generate comprehensive analytical reports (e.g., peak hours, wait time averages).

5. Secure Electronic Patient Records (EMR):
A centralized, digital repository for securely maintaining patient health data, diagnoses, and treatment histories, seamlessly integrated with the active queue for immediate retrieval during consultations.

6. Dynamic Queue Logic & Priority Triage:
The backend engine (powered by Supabase) dedicated to assigning sequential tickets, synchronizing live updates across all devices, and providing staff with the ability to manually override the standard queue order for high-priority cases (e.g., emergencies, seniors, PWDs).
