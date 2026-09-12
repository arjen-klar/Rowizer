/**
 * KlassenroosterUiManager - Manages the multi-class schedule grid view
 * Displays multiple class schedules side-by-side on a single screen (1920x1080)
 * Empty schedules are automatically hidden
 */
export class KlassenroosterUiManager {
    
    constructor(element, connector, dagroosterManager, specificClasses = null) {
        this.element = element;
        this.connector = connector;
        this.dagroosterManager = dagroosterManager;
        this.specificClasses = specificClasses; // Array of class codes to display, or null for all
        this.groups = [];
        this.filteredGroups = [];
    }

    /**
     * Initialize the klassenrooster view
     */
    async init() {
        await this.connector.waitUntilReady();
        this.groups = this.getAllGroups();
        
        // Filter groups based on specified classes or use all
        if (this.specificClasses && this.specificClasses.length > 0) {
            this.filteredGroups = this.groups.filter(group => 
                this.specificClasses.some(classCode => 
                    group.extendedName.toLowerCase().includes(classCode.toLowerCase())
                )
            );
        } else {
            // If no specific classes given, use all groups
            this.filteredGroups = this.groups;
        }

        if (this.filteredGroups.length === 0) {
            console.warn("No matching groups found");
            this.element.innerHTML = '<p>Geen klassen gevonden</p>';
            return;
        }

        this.render();
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
     * Render all class schedules in a grid
     */
    async render() {
        this.element.innerHTML = '';
        
        const gridContainer = document.createElement('div');
        gridContainer.classList.add('klassenrooster-grid');

        // Load appointments for all groups and filter out empty ones
        const groupsWithAppointments = [];

        for (const group of this.filteredGroups) {
            const appointments = await this.dagroosterManager.getGroupAppointments(group.id);
            
            // Only include groups that have appointments
            if (appointments.length > 0) {
                groupsWithAppointments.push({ group, appointments });
            }
        }

        // Calculate optimal grid layout based on number of classes
        const numClasses = groupsWithAppointments.length;
        const { columns } = this.calculateGridLayout(numClasses);

        gridContainer.style.setProperty('--grid-columns', columns);

        // Render each class schedule
        for (const { group, appointments } of groupsWithAppointments) {
            const classCard = await this.createClassCard(group, appointments);
            gridContainer.appendChild(classCard);
        }

        this.element.appendChild(gridContainer);
    }

    /**
     * Calculate optimal grid layout for 1920x1080 resolution
     */
    calculateGridLayout(numClasses) {
        // For 1920x1080, calculate columns to fit optimally
        if (numClasses <= 2) return { columns: 2 };
        if (numClasses <= 4) return { columns: 2 };
        if (numClasses <= 6) return { columns: 3 };
        return { columns: 3 };
    }

    /**
     * Create a single class schedule card
     */
    async createClassCard(group, appointments) {
        const card = document.createElement('div');
        card.classList.add('klassenrooster-card');

        // Header with class name
        const header = document.createElement('div');
        header.classList.add('klassenrooster-card-header');
        
        const className = document.createElement('h2');
        className.classList.add('klassenrooster-card-title');
        className.textContent = group.extendedName;
        header.appendChild(className);

        const date = document.createElement('p');
        date.classList.add('klassenrooster-card-date');
        date.textContent = this.connector.date.toLocaleString('nl-NL', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
        header.appendChild(date);

        card.appendChild(header);

        // Schedule content
        const scheduleContent = document.createElement('div');
        scheduleContent.classList.add('klassenrooster-card-schedule');

        const timeSlots = this.connector.getTodayTimeSlots();
        const currentTimeSlot = this.getCurrentTimeSlot(timeSlots);

        // Time slots with appointments
        timeSlots.forEach((slot, index) => {
            const slotContainer = document.createElement('div');
            slotContainer.classList.add('klassenrooster-slot');

            if (index === currentTimeSlot) {
                slotContainer.classList.add('klassenrooster-slot-current');
            }

            // Time header
            const timeHeader = document.createElement('div');
            timeHeader.classList.add('klassenrooster-slot-time');
            timeHeader.textContent = slot.timeSlotName.name;
            slotContainer.appendChild(timeHeader);

            // Find appointment for this slot
            const appointment = appointments.find(
                app => app.startTimeSlot <= slot.timeSlotName.rank && 
                       app.endTimeSlot >= slot.timeSlotName.rank
            );

            if (appointment) {
                const appointmentDiv = document.createElement('div');
                appointmentDiv.classList.add('klassenrooster-appointment');

                if (appointment.type === 'activity') {
                    appointmentDiv.classList.add('klassenrooster-activity');
                } else if (appointment.cancelled) {
                    appointmentDiv.classList.add('klassenrooster-cancelled');
                } else if (!appointment.valid) {
                    appointmentDiv.classList.add('klassenrooster-invalid');
                } else if (appointment.modified) {
                    appointmentDiv.classList.add('klassenrooster-modified');
                }

                const subject = document.createElement('div');
                subject.classList.add('klassenrooster-appointment-subject');
                subject.textContent = appointment.subjects?.join(', ') || 'Activiteit';
                appointmentDiv.appendChild(subject);

                if (appointment.locations && appointment.locations.length > 0) {
                    const location = document.createElement('div');
                    location.classList.add('klassenrooster-appointment-location');
                    location.textContent = appointment.locations.join(', ');
                    appointmentDiv.appendChild(location);
                }

                slotContainer.appendChild(appointmentDiv);
            } else {
                // Empty slot
                const emptySlot = document.createElement('div');
                emptySlot.classList.add('klassenrooster-empty-slot');
                slotContainer.appendChild(emptySlot);
            }

            scheduleContent.appendChild(slotContainer);
        });

        card.appendChild(scheduleContent);
        return card;
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

        return -1;
    }
}
