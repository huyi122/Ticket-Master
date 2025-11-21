# VIP Ticket Master

A lightweight, pure frontend VIP ticket management system.

## Features

- **Event Management**: Create, Edit, Archive, and Restore events.
- **Ticket Generation**: Batch generate random, unique VIP ticket IDs with custom lengths.
- **Duplicate Protection**: Automatically detects and prevents duplicate ticket IDs during manual entry or batch generation.
- **Validator Mode**: A dedicated interface for staff to verify ticket validity and mark tickets as "Used" in real-time.
- **Data Privacy**: All data is stored locally in your browser's LocalStorage. No external servers are involved.
- **Portable Data**: Built-in **Backup & Restore** functionality allows you to transfer your event data between devices (e.g., from PC to Mobile).

## Getting Started

### Installation
Since this is a static web application, no installation is required.
1. **Local Use**: Simply open the hosted URL or run the project locally.
2. **Deployment**: You can deploy these files to any static hosting provider like Vercel, Netlify, or GitHub Pages.

### How to Transfer Data (PC to Mobile)
Because this app does not use a cloud database, data does not sync automatically. To move data:

1. **On Source Device (e.g., PC)**:
   - Go to the Dashboard.
   - Click the **"Backup"** button.
   - Save the `.json` file.

2. **On Target Device (e.g., Mobile)**:
   - Open the app.
   - Click the **"Restore"** button.
   - Select the `.json` file you just saved.
   - Confirm the restore to load all your events and tickets.

## Usage Guide

### 1. Creating an Event
- Click **"Create Event"** on the dashboard.
- Enter an event name and description.

### 2. Managing Tickets
- Click **"Manage Tickets"** on an event card.
- **Auto-Generate**: Create a batch of random IDs (e.g., 50 tickets of 8 characters).
- **Bulk Add**: Paste a list of existing IDs (one per line). The system will alert you if any duplicates exist.

### 3. Validating Tickets
- Switch to **Validator Mode** via the top navigation.
- Enter or scan a Ticket ID.
- The system will show if the ticket is **Valid**, **Already Used**, or **Invalid**.
- Click **"Mark as Used"** to check in a guest.
