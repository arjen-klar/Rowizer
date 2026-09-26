import ChangesUIRecordClass from "../changes/changesUIRecordClass.js";
import { updateActiveTimeslot } from "./timeslotHighlighter.js";

export class TimetableUiManager {
    constructor(element, connector, changesManager) {
        this.element = element;
        this.connector = connector;
        this.changesManager = changesManager;
        this.setDate(connector.date);
        this.scroller = new TimetableUIScroller();
    }

    setDate(date) {
        this.date = date;
    }

    makeTable() {
        let yearsOfEducation = Object.keys(this.connector.yearsOfEducation).sort();
        let timeslots = Object.values(this.connector.timeslots).sort((a, b) => a.rank - b.rank);

        let container = document.createElement('div');
        container.classList.add("schedule-container", "schedule-flex");
        container.style.setProperty('--years-of-education', yearsOfEducation.at(-1));
        container.style.setProperty('--timeslots', timeslots.at(-1).rank);

        // Header row
        let year_row = document.createElement('div');
        year_row.classList.add("year-row", "schedule-flex", "header");

        let node = document.createElement('div');
        node.classList.add("schedule-flex", "year-header");
        year_row.append(node);

        container.append(year_row);

        let timeslots_box = document.createElement('div');
        timeslots_box.classList.add("schedule-content-container", "timeslot-container", "schedule-flex");
        year_row.append(timeslots_box);

        timeslots.forEach(slot => {
            let el = document.createElement('div');
            el.classList.add("timeslot-header");
            el.innerHTML = slot.name;
            el.setAttribute('data-timeslot', slot.rank);
            timeslots_box.append(el);
        });

        // Year rows
        yearsOfEducation.forEach(year => {
            let el = document.createElement('div');
            el.classList.add("year-row", "schedule-flex");

            let year_cell = document.createElement('div');
            year_cell.classList.add("schedule-flex", "header", "year-header");
            year_cell.innerHTML = year;
            el.append(year_cell);

            let content_cell = document.createElement('div');
            content_cell.classList.add("schedule-content", "schedule-flex");
            el.append(content_cell);

            let content_container = document.createElement('div');
            content_container.classList.add("schedule-content-container");
            content_container.id = "schedule-content-year-" + year;
            content_cell.append(content_container);

            container.append(el);
        });

        this.element.append(container);
        this.updateActiveTimeslot();
    }

    updateActiveTimeslot() {
        const timeslotsBox = this.element.querySelector(".timeslot-container");
        if (timeslotsBox) {
            updateActiveTimeslot(timeslotsBox, this.connector);
        }
    }

    async fillTable() {
        // get all lessons for the day
        let options = {
            branchOfSchool: this.connector.branch.id,
            type: 'lesson',
            fields: ["id","appointmentInstance", "start", "end", "startTimeSlot", "endTimeSlot", "type", "groups", "groupsInDepartments", "locations", "cancelled", "cancelledReason", "modified", "teacherChanged", "groupChanged", "locationChanged", "timeChanged", "moved", "hidden", "changeDescription", "schedulerRemark", "lastModified", "base", "courses", "appointmentLastModified", "remark", "subjects", "teachers","valid", "students"],
            start: this.connector.date.getStartOfDayTime()/1000,
            end: this.connector.date.getEndOfDayTime()/1000
        };

        let appointments = [];
        try{
            appointments = await this.connector.api.appointments.get(options);
        }catch(e){
            console.error(e);
            return;
        }

        // ensure changes data available
        try{ await this.changesManager.loadData(); }catch(e){ console.warn(e); }

        // A change replaces the base appointment for a specific group and period.
        // appointmentInstance is not reliable for matching cancellations and replacements.
        const recordsByGroupAndPeriod = new Map();
        const addAppointments = (items, isChange) => {
            items.forEach(appointment => {
                if(!appointment) return;
                const changePriority = isChange
                    ? (appointment.valid && !appointment.cancelled ? 3 : appointment.valid ? 2 : 1)
                    : 0;

                (appointment.groupsInDepartments || []).forEach(group_id => {
                    let group = this.connector.getGroupInDepartment(group_id);
                    if(!group) return;
                    let branch = this.connector.getDepartmentOfBranch(group.departmentOfBranch);
                    let period = appointment.startTimeSlot;
                    const endPeriod = appointment.type === 'activity'
                        ? appointment.endTimeSlot
                        : appointment.endTimeSlot;

                    while(period <= endPeriod){
                        const key = group_id + ':' + period;
                        const existing = recordsByGroupAndPeriod.get(key);
                        const existingPriority = existing ? existing.changePriority : -1;
                        const modified = appointment.appointmentLastModified || appointment.lastModified || 0;
                        const existingModified = existing ? existing.modified : -1;

                        if(!existing || changePriority > existingPriority ||
                            (changePriority === existingPriority && modified >= existingModified)){
                            recordsByGroupAndPeriod.set(key, {
                                year: branch.yearOfEducation,
                                entity: group,
                                period_start: period,
                                period_end: period,
                                appointment,
                                isChange,
                                changePriority,
                                modified
                            });
                        }
                        period++;
                    }
                });
            });
        };

        addAppointments(appointments, false);
        addAppointments(Object.values(this.changesManager.appointments || {}), true);

        // render chosen appointments, sorted by year -> group -> period
        let records = Array.from(recordsByGroupAndPeriod.values());

        // sort records by year, then by entity name (extendedName or name), then by period_start
        records.sort((a,b)=>{
            if(a.year !== b.year) return Number(a.year) - Number(b.year);
            const nameA = (a.entity.extendedName || a.entity.name || '').toLowerCase();
            const nameB = (b.entity.extendedName || b.entity.name || '').toLowerCase();
            if(nameA !== nameB) return nameA > nameB ? 1 : -1;
            return a.period_start - b.period_start;
        });

        // append in order
        records.forEach(rec => {
            let branchYear = rec.year;
            const container = document.querySelector('#schedule-content-year-' + branchYear);
            if(!container) return;
            let el = new ChangesUIRecordClass(rec.entity, this.connector.getDepartmentOfBranch(rec.entity.departmentOfBranch), rec.period_start, rec.period_end, rec.appointment).getElement();
            if(rec.isChange) el.classList.add('changed');
            container.append(el);
        });

        this.scroller.reset();
        this.scroller.start();
    }

    async refreshTable(){
        this.element.innerHTML = '';
        this.makeTable();
        await this.fillTable();
    }
}

class TimetableUIScroller {
    constructor(){ this.largest = null }
    start(){
        if(!this.largest) return;
        const animate = (largestEl) => {
            let distance = largestEl.scrollHeight - largestEl.clientHeight;
            if(distance <= 0) return;
            let duration = distance * 150;
            $(".schedule-content").animate({scrollTop: distance}, {duration: duration}).promise().then(()=>{
                setTimeout(()=>{
                    $(".schedule-content").animate({scrollTop:0},{duration:300}).promise().then(()=>animate(largestEl));
                },1000);
            });
        };
        animate(this.largest);
    }
    stop(){ $(".schedule-content").stop(); }
    reset(){
        this.largest = null;
        $(".schedule-content").each((i, el)=>{
            if(!this.largest) this.largest = el;
            else if(el.scrollHeight > this.largest.scrollHeight) this.largest = el;
        });
    }
}
