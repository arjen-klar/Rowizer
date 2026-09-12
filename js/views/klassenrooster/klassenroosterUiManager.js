/**
 * KlassenroosterUiManager - Manages the multi-class schedule grid view
 * Displays class schedules grouped by year level (mm1, mm2, mm3, etc.)
 * Rotates through each year group every 8 seconds
 * Full width display optimized for 1920x1080
 */
export class KlassenroosterUiManager {
    
    constructor(element, connector, dagroosterManager, specificClasses = null) {
        this.element = element;
        this.connector = connector;
        this.dagroosterManager = dagroosterManager;
        this.specificClasses = specificClasses;
        this.groups = [];
        this.filteredGroups = [];
        this.yearGroups = []; // Groups organized by year level
        this.currentYearIndex = 0;
        this.rotationInterval = null;
        this.ROTATION_INTERVAL = 8000; // 8 seconds
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

        // Organize groups by year level
        this.organizeByYearLevel();

        if (this.yearGroups.length === 0) {
            console.warn("No year groups found");
            this.element.innerHTML = '<p>Geen jaarniveaus gevonden</p>';
            return;
        }

        // Start rendering with rotation
        this.renderCurrentYearGroup();
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
     * Organize groups by year level (mm1, mm2, mm3, etc.)
     */
    organizeByYearLevel() {
        const yearMap = {};

        // Group classes by year level
        this.filteredGroups.forEach(group => {
            // Extract year level (e.g., "mm1" from "mm.mm1a")
            const match = group.extendedName.match(/([a-zA-Z]+)(\d+)/);
            if (match) {
                const prefix = match[1]; // 'mm'
                const year = match[2];   // '1', '2', etc.
                const yearKey = `${prefix}${year}`;

                if (!yearMap[yearKey]) {
                    yearMap[yearKey] = [];
                }
                yearMap[yearKey].push(group);
            }
        });

        // Convert to sorted array of year groups
        this.yearGroups = Object.keys(yearMap)
            .sort((a, b) => {
                // Sort naturally (mm1, mm2, mm3, ...)
                const numA = parseInt(a.match(/\d+/)[0]);
                const numB = parseInt(b.match(/\d+/)[0]);
                return numA - numB;
            })
            .map(yearKey => ({
                yearKey,
                displayName: yearKey.toUpperCase(),
                groups: yearMap[yearKey].sort((a, b) => 
                    a.extendedName.localeCompare(b.extendedName)
                )
            }));
    }

    /**
     * Render the current year group's schedules
     */
    async renderCurrentYearGroup() {
        const yearGroup = this.yearGroups[this.currentYearIndex];
        if (!yearGroup) return;

        this.element.innerHTML = '';
        
        const container = document.createElement('div');
        container.classList.add('klassenrooster-container');

        // Header with year level name
        const header = document.createElement('div');
        header.classList.add('klassenrooster-header');
        
        const yearTitle = document.createElement('h1');
        yearTitle.classList.add('klassenrooster-year-title');
        yearTitle.textContent = yearGroup.displayName;
        header.appendChild(yearTitle);

        const dateInfo = document.createElement('p');
        dateInfo.classList.add('klassenrooster-header-date');
        dateInfo.textContent = this.connector.date.toLocaleString('nl-NL', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        header.appendChild(dateInfo);

        const rotationInfo = document.createElement('p');
        rotationInfo.classList.add('klassenrooster-rotation-info');
        rotationInfo.textContent = `${this.currentYearIndex + 1} van ${this.yearGroups.length}`;
        header.appendChild(rotationInfo);

        container.appendChild(header);

        // Grid of class schedules
        const gridContainer = document.createElement('div');
        gridContainer.classList.add('klassenrooster-grid');

        // Load appointments and render schedules
        const groupsWithAppointments = [];

        for (const group of yearGroup.groups) {
            const appointments = await this.dagroosterManager.getGroupAppointments(group.id);
            
            // Only include groups that have appointments
            if (appointments.length > 0) {
                groupsWithAppointments.push({ group, appointments });
            }
        }

        // Calculate grid layout based on number of classes in this year
        const numClasses = groupsWithAppointments.length;
        const { columns } = this.calculateGridLayout(numClasses);

        gridContainer.style.setProperty('--grid-columns', columns);

        // Render each class schedule
        for (const { group, appointments } of groupsWithAppointments) {
            const classCard = await this.createClassCard(group, appointments);
            gridContainer.appendChild(classCard);
        }

        container.appendChild(gridContainer);
        this.element.appendChild(container);
    }

    /**
     * Calculate optimal grid layout for 1920x1080 resolution (full width)
     */
    calculateGridLayout(numClasses) {
        // Optimize for full width at 1920x1080
        if (numClasses === 1) return { columns: 1 };
        if (numClasses === 2) return { columns: 2 };
        if (numClasses === 3) return { columns: 3 };
        if (numClasses === 4) return { columns: 4 };
        if (numClasses <= 6) return { columns: 3 };
        return { columns: 4 };
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

    /**
     * Start rotation between year groups
     */
    startRotation() {
        this.rotationInterval = setInterval(() => {
            this.currentYearIndex = (this.currentYearIndex + 1) % this.yearGroups.length;
            this.renderCurrentYearGroup();
        }, this.ROTATION_INTERVAL);
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
     * Manually navigate to a specific year group
     */
    goToYearGroup(index) {
        if (index >= 0 && index < this.yearGroups.length) {
            this.currentYearIndex = index;
            this.renderCurrentYearGroup();
            // Reset rotation timer
            this.stopRotation();
            this.startRotation();
        }
    }

    /**
     * Render current view (for refresh)
     */
    async render() {
        await this.renderCurrentYearGroup();
    }
}
