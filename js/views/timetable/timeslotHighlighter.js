export function updateActiveTimeslot(timeslotsBox, connector) {
    const now = new Date();
    const scheduleDate = connector.date;
    const isViewingToday = scheduleDate.getFullYear() === now.getFullYear()
        && scheduleDate.getMonth() === now.getMonth()
        && scheduleDate.getDate() === now.getDate();

    let activeRank = null;
    if (isViewingToday) {
        const todaySlots = connector.getTodayTimeSlots();
        const activeSlot = todaySlots.find(slot =>
            slot.startDt <= now && now < slot.endDt
        );
        const previousSlot = todaySlots.reduce((previous, slot) =>
            slot.endDt <= now ? slot : previous, null
        );
        const nextSlot = todaySlots.find(slot => slot.startDt > now);
        const isBetweenLessons = previousSlot && nextSlot;
        activeRank = (activeSlot ?? (isBetweenLessons ? previousSlot : null))
            ?.timeSlotName.rank ?? null;
    }

    timeslotsBox.querySelectorAll(".timeslot-header").forEach(header => {
        const isActive = Number(header.dataset.timeslot) === activeRank;
        header.classList.toggle("active", isActive);
        if (isActive) {
            header.setAttribute("aria-current", "time");
        } else {
            header.removeAttribute("aria-current");
        }
    });
}
