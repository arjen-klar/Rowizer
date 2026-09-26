import ChangesUIRecordClass from "./changesUIRecordClass.js";
import { updateActiveTimeslot } from "../timetable/timeslotHighlighter.js";

export class ChangesUiManager {

    constructor(element, connector, manager) {
        this.element = element;
        this.changesManager = manager;
        this.connector = connector;
        this.setDate(connector.date);
        this.scroller = new ChangesUIScroller();
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
        // LET OP: hier GEEN this.scroller.start() meer
    }

    updateActiveTimeslot() {
        const timeslotsBox = this.element.querySelector(".timeslot-container");
        if (timeslotsBox) {
            updateActiveTimeslot(timeslotsBox, this.connector);
        }
    }

    fillTable() {
        let changes = [];
        let app_filtered = Object.values(this.changesManager.appointments)
            .filter(app => app.groupsInDepartments.length);

        let do_app = function (apps, cm) {
            apps.forEach(appointment => {
                (appointment.groupsInDepartments || []).forEach(group_id => {
                    let group = cm.connector.getGroupInDepartment(group_id);
                    let branch = cm.connector.getDepartmentOfBranch(group.departmentOfBranch);
                    let i = appointment.startTimeSlot;

                    if (appointment.type === "activity") {
                        if (
                            appointment.cancelled &&
                            changes.find(c =>
                                c.entity.id === group.id &&
                                c.period_start <= appointment.startTimeSlot &&
                                c.period_end >= appointment.endTimeSlot
                            )
                        ) {
                            return;
                        }
                        changes.push(new ChangesUIRecordClass(group, branch, appointment.startTimeSlot, appointment.endTimeSlot, appointment));
                    } else {
                        while (i <= appointment.endTimeSlot) {
                            if (changes.find(c =>
                                c.entity.id === group.id &&
                                c.period_start <= i &&
                                c.period_end >= i
                            )) {
                                return;
                            }

                            changes.push(new ChangesUIRecordClass(group, branch, i, i, appointment));
                            i++;
                        }
                    }
                });
            });
        };

        do_app(app_filtered.filter(app => app.type === 'activity' && app.valid && !app.cancelled), this);
        do_app(app_filtered.filter(app => app.type === 'activity' && app.valid && app.cancelled), this);

        do_app(app_filtered.filter(app => app.type === 'lesson' && app.valid && !app.cancelled), this);
        do_app(app_filtered.filter(app => app.type === 'lesson' && app.valid && app.cancelled), this);

        do_app(app_filtered.filter(app => app.type === "lesson" && !app.valid), this);

        changes
            .sort((a, b) => {
                if (a.appointment.type !== b.appointment.type) {
                    return a.appointment.type === 'lesson' ? 1 : -1;
                } else if (a.entity !== b.entity) {
                    return a.entity.extendedName > b.entity.extendedName ? 1 : -1;
                }
                return 0;
            })
            .forEach(change => {
                let container = document.querySelector("#schedule-content-year-" + change.departmentOfBranch.yearOfEducation);
                let element = change.getElement();
                element.classList.add("changed");
                container.append(element);
            });

        // NU pas starten we de scroller, als alle content er staat
        this.scroller.reset();
        this.scroller.start();
    }

    async refreshTable() {
        try {
            var changes = await this.changesManager.loadData();
        } catch (e) {
            console.error(e);
            return;
        }

        if (Object.keys(changes).length) {
            this.scroller.stop();
            this.element.innerHTML = "";
            this.makeTable();
            this.fillTable();
        }
    }
}

/* ---------------------------------------------------------
   FIXED SCROLLER
--------------------------------------------------------- */

class ChangesUIScroller {
    constructor() {
        this.largest = null;
    }

    start() {
        // reset wordt nu expliciet in fillTable() aangeroepen
        if (!this.largest) return;

        let animate = (largestEl) => {
            let distance = largestEl.scrollHeight - largestEl.clientHeight;

            if (distance <= 0) return;

            let duration = distance * 150;

            $(".schedule-content")
                .animate({ scrollTop: distance }, { duration: duration })
                .promise()
                .then(() => {
                    setTimeout(() => {
                        $(".schedule-content")
                            .animate({ scrollTop: 0 }, { duration: 300 })
                            .promise()
                            .then(() => animate(largestEl));
                    }, 1000);
                });
        };

        animate(this.largest);
    }

    stop() {
        $(".schedule-content").stop();
    }

    reset() {
        this.largest = null;

        $(".schedule-content").each((index, el) => {
            if (!this.largest) {
                this.largest = el;
            } else if (el.scrollHeight > this.largest.scrollHeight) {
                this.largest = el; // element, geen getal
            }
        });
    }
}
