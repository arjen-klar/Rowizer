/**
 * Dagrooster - Manages daily schedule data for groups
 * Fetches and organizes appointments for display in dagrooster view
 */
export class Dagrooster {
    
    constructor(connector) {
        this.connector = connector;
        this.appointments = {};
        this.groupAppointmentsCache = {};
    }

    /**
     * Load all appointments for the current date
     */
    async loadData() {
        const common_data = {
            branchOfSchool: this.connector.branch.id,
            fields: [
                'id', 'appointmentInstance', 'start', 'end', 'startTimeSlot', 
                'endTimeSlot', 'type', 'groups', 'groupsInDepartments', 
                'locations', 'subjects', 'cancelled', 'cancelledReason', 
                'modified', 'teachers'
            ],
            start: this.connector.date.getStartOfDayTime() / 1000,
            end: this.connector.date.getEndOfDayTime() / 1000
        };

        try {
            // Get both lesson and activity appointments
            const lessonsData = await this.connector.api.appointments.get({
                ...common_data,
                type: 'lesson'
            });

            const activitiesData = await this.connector.api.appointments.get({
                ...common_data,
                type: 'activity'
            });

            // Combine both
            const allAppointments = [...lessonsData, ...activitiesData];

            // Store by ID for easy access
            allAppointments.forEach(app => {
                this.appointments[app.id] = app;
            });

            return allAppointments;
        } catch (error) {
            console.error('Error loading dagrooster data:', error);
            return [];
        }
    }

    /**
     * Get all appointments for a specific group
     */
    async getGroupAppointments(groupId) {
        // Check cache first
        if (this.groupAppointmentsCache[groupId]) {
            return this.groupAppointmentsCache[groupId];
        }

        const groupAppointments = Object.values(this.appointments).filter(appointment => {
            return appointment.groupsInDepartments && 
                   appointment.groupsInDepartments.includes(groupId);
        });

        // Sort by start time slot
        groupAppointments.sort((a, b) => a.startTimeSlot - b.startTimeSlot);

        // Cache the result
        this.groupAppointmentsCache[groupId] = groupAppointments;

        return groupAppointments;
    }

    /**
     * Reset cache when data changes
     */
    reset() {
        this.appointments = {};
        this.groupAppointmentsCache = {};
    }

    /**
     * Refresh data periodically
     */
    async refresh() {
        this.reset();
        return this.loadData();
    }
}
