/**
 * DagroosterUiManager - Manages the daily schedule view for a single group
 * Shows one group's complete daily schedule with current hour highlighting
 */
export class DagroosterUiManager {
    
    constructor(element, connector, dagroosterManager) {
        this.element = element;
        this.connector = connector;
        this.dagroosterManager = dagroosterManager;
        this.currentGroupIndex = 0;
        this.groups = [];
        this.rotationInterval = null;
    }

    /**
     * Initialize and start the dagrooster view
     */
    async init() {
        await this.connector.waitUntilReady();
        this.groups = this.getAllGroups();
        
        if (this.groups.length === 0) {
            console.warn("No groups found");
            return;
        }

        this.renderCurrentGroup();
        this.startRotation();
    }

    /**
     * Get all unique groups from connector
     */
    getAllGroups() {
        const groups = [];
        const seenIds = new Set();

        Object.values(this.connector.groupsInDepartment).forEach(group => {
            if (!seenIds.has(group.id)) {
                groups.push(group);
                seenIds.add(group.id);
            }
        });

        // Sort by extended name for consistent ordering
        return groups.sort((a, b) => a.extendedName.localeCompare(b.extendedName));
    }

    /**
     * Render the current group's schedule
     */
    async renderCurrentGroup() {
        const group = this.groups[this.currentGroupIndex];
        if (!group) return;

        this.element.innerHTML = '';
        
        const container = document.createElement('div');
        container.classList.add('dagrooster-container');
        
        // Header with group name and date
        const header = this.createHeader(group);
        container.appendChild(header);

        // Daily schedule table
        const schedule = await this.createSchedule(group);
        container.appendChild(schedule);

        this.element.appendChild(container);
    }

    /**
     * Create header section with group name and date
     */
    createHeader(group) {
        const header = document.createElement('div');
        header.classList.add('dagrooster-header');

        const groupName = document.createElement('div');
        groupName.classList.add('dagrooster-group-name');
        groupName.textContent = group.extendedName;

        const dateDisplay = document.createElement('div');
        dateDisplay.classList.add('dagrooster-date');
        dateDisplay.textContent = this.connector.date.toLocaleString('nl-NL', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        header.appendChild(groupName);
        header.appendChild(dateDisplay);

        return header;
    }

    /**
     * Create schedule table for the group
     */
    async createSchedule(group) {
        const scheduleContainer = document.createElement('div');
        scheduleContainer.classList.add('dagrooster-schedule');

        const appointments = await this.dagroosterManager.getGroupAppointments(group.id);
        const timeSlots = this.connector.getTodayTimeSlots();
        const currentTimeSlot = this.getCurrentTimeSlot(timeSlots);

        // Create time slot headers
        const headerRow = document.createElement('div');
        headerRow.classList.add('dagrooster-time-row', 'dagrooster-header-row');

        timeSlots.forEach(slot => {
            const headerCell = document.createElement('div');
            headerCell.classList.add('dagrooster-time-cell', 'dagrooster-time-header');
            headerCell.textContent = slot.timeSlotName.name;
            headerRow.appendChild(headerCell);
        });

        scheduleContainer.appendChild(headerRow);

        // Create appointment row
        const appointmentRow = document.createElement('div');
        appointmentRow.classList.add('dagrooster-time-row', 'dagrooster-appointment-row');

        timeSlots.forEach((slot, index) => {
            const cell = document.createElement('div');
            cell.classList.add('dagrooster-time-cell');

            // Highlight current time slot
            if (index === currentTimeSlot) {
                cell.classList.add('dagrooster-time-cell-current');
            }

            // Find appointment for this slot
            const appointment = appointments.find(
                app => app.startTimeSlot <= slot.timeSlotName.rank && 
                       app.endTimeSlot >= slot.timeSlotName.rank
            );

            if (appointment) {
                const appointmentDiv = document.createElement('div');
                appointmentDiv.classList.add('dagrooster-appointment');
                
                if (appointment.type === 'activity') {
                    appointmentDiv.classList.add('dagrooster-activity');
                } else if (appointment.cancelled) {
                    appointmentDiv.classList.add('dagrooster-cancelled');
                } else if (!appointment.valid) {
                    appointmentDiv.classList.add('dagrooster-invalid');
                } else if (appointment.modified) {
                    appointmentDiv.classList.add('dagrooster-modified');
                }

                const subjectDiv = document.createElement('div');
                subjectDiv.classList.add('dagrooster-subject');
                subjectDiv.textContent = appointment.subjects?.join(', ') || 'Activiteit';

                const locationDiv = document.createElement('div');
                locationDiv.classList.add('dagrooster-location');
                locationDiv.textContent = appointment.locations?.join(', ') || '';

                appointmentDiv.appendChild(subjectDiv);
                if (locationDiv.textContent) {
                    appointmentDiv.appendChild(locationDiv);
                }

                cell.appendChild(appointmentDiv);
            }

            appointmentRow.appendChild(cell);
        });

        scheduleContainer.appendChild(appointmentRow);

        return scheduleContainer;
    }

    /**
     * Get the current time slot index
     */
    getCurrentTimeSlot(timeSlots) {
        const now = new Date();
        
        for (let i = 0; i < timeSlots.length; i++) {
            if (now >= timeSlots[i].startDt && now <= timeSlots[i].endDt) {
                return i;
            }
        }

        // Return -1 if no current slot found (before school or after school)
        return -1;
    }

    /**
     * Start automatic rotation between groups
     */
    startRotation() {
        // Rotate every 10 seconds
        this.rotationInterval = setInterval(() => {
            this.currentGroupIndex = (this.currentGroupIndex + 1) % this.groups.length;
            this.renderCurrentGroup();
        }, 10000);
    }

    /**
     * Stop rotation
     */
    stopRotation() {
        if (this.rotationInterval) {
            clearInterval(this.rotationInterval);
            this.rotationInterval = null;
        }
    }

    /**
     * Manually navigate to a specific group
     */
    goToGroup(index) {
        if (index >= 0 && index < this.groups.length) {
            this.currentGroupIndex = index;
            this.renderCurrentGroup();
            // Reset rotation timer
            this.stopRotation();
            this.startRotation();
        }
    }
}
