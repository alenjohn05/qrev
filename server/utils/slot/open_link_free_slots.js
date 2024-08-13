/*
 * File created on 17th March 2023
 */

import _ from "lodash";

const { cloneDeep } = _;

// const moment = require("moment");
import moment from "moment";
import momenttz from "moment-timezone";

const dateFormat = "YYYY-MM-DD",
    timeZoneFormat = "THH:mm:ss.SS";
const msPerDay = 86400000; //milliseconds in a day

/*
 ** 	@rangeStartTime = 1618045032389
 **	  @rangeEndTime = 1623219978615
 **	  @windowStartTime = 09:00
 ** 	@windowEndTime = 17:00
 **   @organizerTz =  Asia/Calcutta
 **   The purpose of this method is to essentially treat daily windows
 ** 	as the free slots;
 **/
const getFreeWindows = (
    rangeStartTime,
    rangeEndTime,
    windowStartTime,
    windowEndTime,
    organizerTz,
    skipWeekend,
    count = 60
) => {
    // var referenceTime = moment(rangeStartTime).startOf("day")
    var referenceTime = moment(rangeStartTime).tz(organizerTz).startOf("day");

    let index = 0;
    var freeSlots = [];

    let daysBetween = getRequestedDateRange(rangeStartTime, rangeEndTime); // 3

    while (index < daysBetween) {
        let windowStartHours = windowStartTime.split(":")[0];
        let windowStartMinutes = windowStartTime.split(":")[1];

        var refStartTime = referenceTime.clone().add(windowStartHours, "hours");
        refStartTime.add(windowStartMinutes, "minutes");

        let windowEndHours = windowEndTime.split(":")[0];
        let windowEndMinutes = windowEndTime.split(":")[1];

        var refEndTime = referenceTime.clone().add(windowEndHours, "hours");
        refEndTime.add(windowEndMinutes, "minutes");

        // NOTE: the end time could be on a monday morning.
        // in which case we will need to add more checks
        if (
            !skipWeekend ||
            (refStartTime.day() !== 6 && refStartTime.day() !== 0)
        ) {
            freeSlots.push({
                start: refStartTime.valueOf(),
                end: refEndTime.valueOf(),
            });
        }
        index++;
        referenceTime = referenceTime.clone().add(24, "hours");
    }
    return freeSlots;
};

const freeBusyByDay = (freeSlots, busySlots, attendeeTz) => {
    var slotsByDay = {};
    // eslint-disable-next-line
    freeSlots.forEach((slot) => {
        let day = moment(slot.start).tz(attendeeTz).format("DDMMMYYYY");
        if (!slotsByDay[day]) {
            slotsByDay[day] = {
                free: [],
                busy: [],
                freeUnchunked: [],
                freeChunked: [],
            };
        }
        slotsByDay[day].free.push(slot);
    });
    // eslint-disable-next-line
    busySlots.forEach((slot) => {
        if (slot && slot.start) {
            let day = moment(slot.start).tz(attendeeTz).format("DDMMMYYYY");
            if (!slotsByDay[day]) {
                slotsByDay[day] = {
                    free: [],
                    busy: [],
                    freeUnchunked: [],
                    freeChunked: [],
                };
            }
            slotsByDay[day].busy.push(slot);
        }
    });
    return slotsByDay;
};

const sortEvents = (x, y) => {
    if (new Date(x.start).getTime() < new Date(y.start).getTime()) return -1;
    if (new Date(y.start).getTime() < new Date(x.start).getTime()) return 1;
    return 0;
};

const busyByDaySorted = (byDay) => {
    let result = Object.assign({}, byDay);
    let dates = Object.keys(byDay);
    dates.forEach((d, i) => {
        result[d].busySorted = result[d].busy.sort((x, y) => sortEvents(x, y));
    });
    return result;
};

// sorrt the free slots for each day
// while you iterate, you can keep an array of the dates . the keys of the object

const getFreeFromBusy = (freeStart, freeEnd, busySlots, attendeeTz) => {
    let today = new Date();
    let now = today.getTime();
    let freeSlots = [];
    let skipSlot = false;

    var start = freeStart;
    let end = freeEnd;

    if (now > freeStart && now < freeEnd) {
        start = now;
    } else if (now >= freeEnd) {
        return [];
    }

    if (!busySlots || busySlots.length === 0) {
        return [
            {
                start: freeStart,
                end: freeEnd,
            },
        ];
    }

    busySlots.forEach((slot, i) => {
        if (!skipSlot) {
            let busyStart = moment(slot.start).tz(attendeeTz).valueOf();
            let busyEnd = moment(slot.end).tz(attendeeTz).valueOf();

            if (busyStart <= start && busyEnd >= end) {
                skipSlot = true;
            } else if (busyStart <= start && busyEnd < end && busyEnd > start) {
                start = busyEnd;
            } else if (busyStart > start && busyStart < end && busyEnd >= end) {
                end = busyStart;
            } else if (busyStart > start && busyEnd < end) {
                let freeSlot = {
                    start: start,
                    end: busyStart,
                    startFormatted: moment(start).tz(attendeeTz).format("LLL"),
                    endFormatted: moment(busyStart)
                        .tz(attendeeTz)
                        .format("LLL"),
                };
                freeSlots.push(freeSlot);
                start = busyEnd;
            }
        }
    });

    if (!skipSlot) {
        let freeSlot = {
            start: start,
            end: end,
            startFormatted: moment(start).tz(attendeeTz).format("LLL"),
            endFormatted: moment(end).tz(attendeeTz).format("LLL"),
        };
        freeSlots.push(freeSlot);
    }
    return freeSlots;
};

const generateFreeSlot = (startTime, endTime, attendeeTz) => {
    let date = moment(startTime).tz(attendeeTz).format(dateFormat);
    // freeSlots.push({ start: moment(dayWindowStartTime).format(`${date}${timeZoneFormat}`), end: moment(endTimeOffset).format(`${date}${timeZoneFormat}`) })
    return {
        // id: uuidv4(),
        startTime: startTime,
        start: moment(startTime)
            .tz(attendeeTz)
            .startOf("minute")
            .format(`${date}${timeZoneFormat}`),
        endTime: endTime,
        end: moment(endTime)
            .tz(attendeeTz)
            .startOf("minute")
            .format(`${date}${timeZoneFormat}`),
        // isFreeSlot: true,
        // startLabel: moment(startTime).format("dddd, MMMM Do YYYY, h:mm a"),
        // endLabel: moment(endTime).format("dddd, MMMM Do YYYY, h:mm a")
    };
};

const chunkFreeSlots = (slotStartMs, slotEndMs, duration, attendeeTz) => {
    let results = [];
    let durationMs = (duration - 1) * 60 * 1000;
    if (slotEndMs - slotStartMs < durationMs) {
        return results;
    }

    var roundTo = 15;
    if (
        duration === 5 ||
        duration === 10 ||
        duration === 15 ||
        duration === 20 ||
        duration === 30
    ) {
        roundTo = duration;
    } else if (duration === 60) {
        roundTo = 30;
    } else {
        // this coud be for some absurd combination
        // but also for 45 min for instance.
        roundTo = 30;
    }

    let closestStartTime = getRoundedMinute(
        slotStartMs,
        roundTo,
        attendeeTz
    ).clone();
    // let closestEndTime = getRoundedMinute(slotEndMs, duration).clone();
    //  we should not try to round down the end time
    // cos naturally if something is left over which is less
    // than the duration, it will not be added to the chunked
    // free slots
    let endTime = moment(slotEndMs).clone();

    //   let durationMs = duration * 60 * 1000;

    while (endTime.diff(closestStartTime) >= durationMs) {
        // let slotStart = closestStartTime.valueOf();
        let slotEnd = closestStartTime.clone().add(duration, "minutes");
        let slot = generateFreeSlot(
            closestStartTime.valueOf(),
            slotEnd.valueOf(),
            attendeeTz
        );
        results.push(slot);
        // closestStartTime = slotEnd;
        closestStartTime = getRoundedMinute(
            slotEnd,
            roundTo,
            attendeeTz
        ).clone();
    }
    return results;
};

const chunkGroupFreeSlots = (slotStartMs, slotEndMs, duration, originSlot) => {
    let results = [];
    let durationMs = duration * 60 * 1000;
    if (slotEndMs - slotStartMs < durationMs) {
        return results;
    }

    var roundTo = 15;
    if (
        duration === 5 ||
        duration === 10 ||
        duration === 15 ||
        duration === 20 ||
        duration === 30
    ) {
        roundTo = duration;
    } else if (duration === 60) {
        roundTo = 30;
    } else {
        // this coud be for some absurd combination
        // but also for 45 min for instance.
        roundTo = 30;
    }

    let closestStartTime = getRoundedMinute(slotStartMs, roundTo).clone();
    // let closestEndTime = getRoundedMinute(slotEndMs, duration).clone();
    //  we should not try to round down the end time
    // cos naturally if something is left over which is less
    // than the duration, it will not be added to the chunked
    // free slots
    let endTime = moment(slotEndMs).clone();

    //   let durationMs = duration * 60 * 1000;

    while (endTime.diff(closestStartTime) >= durationMs) {
        // let slotStart = closestStartTime.valueOf();
        let slotEnd = closestStartTime.clone().add(duration, "minutes");
        let slot = generateFreeSlot(
            closestStartTime.valueOf(),
            slotEnd.valueOf()
        );
        slot["noOfVotes"] = originSlot.noOfVotes;
        slot["voters"] = originSlot.voters;
        slot["_id"] = originSlot._id;
        results.push(slot);
        // closestStartTime = slotEnd;
        closestStartTime = getRoundedMinute(slotEnd, roundTo).clone();
    }
    return results;
};

// Getting difference between date range ie. 11Jun - 8Jun = 3. 3 is returned
const getRequestedDateRange = (rangeStartTime, rangeEndTime) => {
    let diff = rangeEndTime - rangeStartTime;
    let totalDays = Math.ceil(diff / msPerDay);
    return totalDays;
};

/*
 ** Let's say the slot starts at 11:23 am, so we should start
 ** chunking from 11:30 am depending on the duration of the slot
 ** the good thing is that for typical slots, 5, 10, 15, 20, 30
 ** we can find the closest start minute and end minute as well.
 **
 */
// https://stackoverflow.com/questions/25323823/round-moment-js-object-time-to-nearest-30-minute-interval
const getRoundedMinute = (actualSlotBoundTime, roundTo, attendeeTz) => {
    let start = moment(actualSlotBoundTime).tz(attendeeTz).clone();

    // e.g start = moment('2020-05-08 09:42');
    let remainder = roundTo - (start.minute() % roundTo);

    remainder = remainder === roundTo ? 0 : remainder;

    let newBoundTime = moment(start)
        .clone()
        .tz(attendeeTz)
        .add(remainder, "minutes");
    return newBoundTime;
};

const getFreeChunkedSlots = (freeSlots, attendeeTz, interval = 30) => {
    let freeChunked = [];
    freeSlots.forEach((freeSlot, i) => {
        // getChunkedSlots(freeSlot)
        let chunkedSlots = chunkFreeSlots(
            freeSlot.start,
            freeSlot.end,
            interval,
            attendeeTz
        );
        freeChunked = freeChunked.concat(chunkedSlots);
    });
    return freeChunked;
};

const getGroupFreeChunkedSlots = (freeSlots, interval = 30) => {
    let freeChunked = [];
    freeSlots.forEach((freeSlot, i) => {
        // getChunkedSlots(freeSlot)
        let chunkedSlots = chunkGroupFreeSlots(
            freeSlot.start,
            freeSlot.end,
            interval,
            freeSlot
        );
        freeChunked = freeChunked.concat(chunkedSlots);
    });
    return freeChunked;
};

const getFreeSlots = (
    clickedFreeSlots,
    finalBusyConcatenated,
    attendeeTz,
    duration = 30
) => {
    var slotsByDay = Object.assign(
        {},
        freeBusyByDay(clickedFreeSlots, finalBusyConcatenated, attendeeTz)
    );

    let busyAfterSort = busyByDaySorted(slotsByDay);
    var busyAfterSortClone = Object.assign({}, busyAfterSort);

    let days = Object.keys(busyAfterSort);
    // getFreeFromBusy
    var finalFreeSlots = [];

    days.forEach((day) => {
        let busySlotsForDay = busyAfterSort[day].busySorted;
        // eslint-disable-next-line
        busyAfterSort[day].free.forEach((freeSlot) => {
            let freeUnchunked = getFreeFromBusy(
                freeSlot.start,
                freeSlot.end,
                busySlotsForDay,
                attendeeTz
            );
            busyAfterSortClone[day].freeUnchunked.push(freeUnchunked);
            // busyAfterSortClone[day].freeChunked.push(getFreeChunkedSlots(freeUnchunked));
            finalFreeSlots = finalFreeSlots.concat(
                getFreeChunkedSlots(freeUnchunked, attendeeTz, duration)
            );
        });
    });
    busyAfterSort = null;
    return finalFreeSlots;
};

const parseTimeText = (text, attendeeTz) => {
    if (text.includes("m") || text.includes("M")) {
        const date = new Date(moment(text, "hh:mm a"));
        const parsedText = moment(date).format("HH:mm");
        // console.log(`\ntext: ${text}, parsedText: `,parsedText);
        return parsedText;
    } else {
        // console.log(`\ntext: ${text}, parsedText: `,text);
        return text;
    }
};

export const createFreeFromBusySlotsOpenLinkNew = (
    {
        busy,
        window_start_time,
        window_end_time,
        range_start_time,
        range_end_time,
        window_start_time_tz,
        duration,
        attendeeTz,
    },
    skipWeekend = false
) => {
    let freeWindowSlots = [];
    if (
        range_start_time &&
        range_end_time &&
        window_start_time &&
        window_end_time &&
        window_start_time_tz
    ) {
        freeWindowSlots = getFreeWindows(
            range_start_time,
            range_end_time,
            window_start_time,
            window_end_time,
            window_start_time_tz,
            skipWeekend
        );
    }
    // const freeSlots = freeWindowSlots.length ? getFreeSlots(freeWindowSlots, busy, duration) : []

    const dayByFreeWindowSlots = getDayByFreeWindowSlots(
        freeWindowSlots,
        attendeeTz
    );
    const dayByBusySlots = getDayByBusy(busy, attendeeTz);
    const freeSlots = dayByFreeWindowSlots.length
        ? getFreeSlots(
              dayByFreeWindowSlots,
              dayByBusySlots,
              attendeeTz,
              duration
          )
        : [];
    return freeSlots;
};

const getDayByFreeWindowSlots = (win_slots, attendeeTz) => {
    let results = [],
        startDate,
        endDate;

    if (!win_slots || !win_slots.length) return results;

    win_slots.forEach((slot) => {
        startDate = moment(slot.start).tz(attendeeTz).format("DDMMMYYYY");
        endDate = moment(slot.end).tz(attendeeTz).format("DDMMMYYYY");

        if (startDate === endDate) {
            results.push(slot);
        } else {
            results.push({
                start: slot.start,
                end: moment(slot.start).tz(attendeeTz).endOf("day").valueOf(),
            });
            results.push({
                start: moment(slot.end).tz(attendeeTz).startOf("day").valueOf(),
                end: slot.end,
            });
        }
    });

    return results;
};

const getDayByBusy = (busy_slots, attendeeTz) => {
    let results = [],
        startDate,
        endDate;

    if (!busy_slots || !busy_slots.length) return results;

    busy_slots.forEach((slot) => {
        if (slot && slot.start && slot.end) {
            startDate = cloneDeep(moment(slot.start).tz(attendeeTz)).format(
                "DDMMMYYYY"
            );
            endDate = cloneDeep(moment(slot.end).tz(attendeeTz)).format(
                "DDMMMYYYY"
            );

            if (startDate === endDate) {
                results.push(slot);
            } else {
                const onedayStamp = 24 * 60 * 60 * 1000;

                let busySlotStart = cloneDeep(
                        moment(slot.start).tz(attendeeTz)
                    ).valueOf(),
                    loop = true;

                results.push({
                    start: cloneDeep(
                        moment(busySlotStart).tz(attendeeTz)
                    ).format("YYYY-MM-DDTHH:mm:ssZ"),
                    end: cloneDeep(moment(busySlotStart).tz(attendeeTz))
                        .endOf("day")
                        .format("YYYY-MM-DDTHH:mm:ssZ"),
                });

                busySlotStart += onedayStamp;

                while (loop) {
                    if (
                        cloneDeep(moment(busySlotStart).tz(attendeeTz)).format(
                            "YYYY-MM-DD"
                        ) === "Invalid date" ||
                        cloneDeep(moment(slot.end).tz(attendeeTz)).format(
                            "YYYY-MM-DD"
                        ) === "Invalid date" ||
                        cloneDeep(moment(busySlotStart).tz(attendeeTz)).format(
                            "YYYY-MM-DD"
                        ) ===
                            cloneDeep(moment(slot.end).tz(attendeeTz)).format(
                                "YYYY-MM-DD"
                            )
                    ) {
                        loop = false;
                    } else {
                        results.push({
                            start: moment(busySlotStart)
                                .tz(attendeeTz)
                                .startOf("day")
                                .format("YYYY-MM-DDTHH:mm:ssZ"),
                            end: moment(busySlotStart)
                                .tz(attendeeTz)
                                .endOf("day")
                                .format("YYYY-MM-DDTHH:mm:ssZ"),
                        });
                        busySlotStart += onedayStamp;
                    }
                }

                results.push({
                    start: cloneDeep(moment(slot.end).tz(attendeeTz))
                        .startOf("day")
                        .format("YYYY-MM-DDTHH:mm:ssZ"),
                    end: slot.end,
                });
            }
        }
    });

    return results;
};

export const createFreeFromBusySlotsOpenLinkNewCustomHours = (
    slots_details,
    skipWeekend,
    attendeeTz
) => {
    const {
        busy,
        range_start_time,
        range_end_time,
        window_start_time_tz,
        duration,
        custom_hours,
    } = slots_details;

    const customHoursKeys = Object.keys(custom_hours);

    let results = [];
    customHoursKeys.forEach((key) => {
        custom_hours[key].forEach((item) => {
            const { start, end } = item;
            const newParam = {
                busy,
                window_start_time: parseTimeText(start, attendeeTz),
                window_end_time: parseTimeText(end, attendeeTz),
                range_start_time,
                range_end_time,
                window_start_time_tz,
                duration,
                attendeeTz,
            };
            // console.log(`\nnewParam: `,JSON.stringify(newParam));
            const busySlots = createFreeFromBusySlotsOpenLinkNew(
                newParam,
                skipWeekend
            );
            const filteredBusySlots = _.filter(busySlots, (o) => {
                return (
                    moment(o.startTime)
                        .tz(window_start_time_tz)
                        .format("ddd")
                        .toLowerCase() === key
                );
            });
            // console.log(`\n\nfree before filter: ${JSON.stringify(busySlots)}`);
            // console.log(`\nfree after filter: ${JSON.stringify(filteredBusySlots)}`);
            if (filteredBusySlots && filteredBusySlots.length) {
                results = [...results, ...filteredBusySlots];
            }
        });
    });

    return _.orderBy(results, (o) => o.startTime);
};

export const createFreeFromBusySlotsDraggedSlotNew = ({
    busy,
    dragged_slots,
    duration,
}) => {
    // ! in server below function needs oe more parameter called attendeeTz
    return getFreeSlots(dragged_slots, busy, duration);
};

export const createGroupFreeFromBusySlotsDraggedSlotNew = ({
    busy,
    dragged_slots,
    duration,
}) => {
    return getGroupFreeSlots(dragged_slots, busy, duration);
};

const getGroupFreeSlots = (
    clickedFreeSlots,
    finalBusyConcatenated,
    duration = 30
) => {
    // ! in server below function needs oe more parameter called attendeeTz
    var slotsByDay = Object.assign(
        {},
        freeBusyByDay(clickedFreeSlots, finalBusyConcatenated)
    );

    let busyAfterSort = busyByDaySorted(slotsByDay);
    var busyAfterSortClone = Object.assign({}, busyAfterSort);

    let days = Object.keys(busyAfterSort);
    // getFreeFromBusy
    var finalFreeSlots = [];

    days.forEach((day) => {
        let busySlotsForDay = busyAfterSort[day].busySorted;
        // eslint-disable-next-line
        busyAfterSort[day].free.forEach((freeSlot) => {
            let freeUnchunked = getGroupFreeFromBusy(
                freeSlot.start,
                freeSlot.end,
                busySlotsForDay,
                freeSlot
            );
            busyAfterSortClone[day].freeUnchunked.push(freeUnchunked);
            // busyAfterSortClone[day].freeChunked.push(getFreeChunkedSlots(freeUnchunked));
            finalFreeSlots = finalFreeSlots.concat(
                getGroupFreeChunkedSlots(freeUnchunked, duration)
            );
        });
    });
    busyAfterSort = null;
    return finalFreeSlots;
};

const getGroupFreeFromBusy = (freeStart, freeEnd, busySlots, originSlot) => {
    let today = new Date();
    let now = today.getTime();
    let freeSlots = [];
    let skipSlot = false;

    var start = freeStart;
    let end = freeEnd;
    let noOfVotes = originSlot.noOfVotes,
        voters = originSlot.voters,
        _id = originSlot._id;

    if (now > freeStart && now < freeEnd) {
        start = now;
    } else if (now >= freeEnd) {
        return [];
    }

    if (!busySlots || busySlots.length === 0) {
        return [
            {
                start: freeStart,
                end: freeEnd,
                noOfVotes: originSlot.noOfVotes,
                voters: originSlot.voters,
                _id: originSlot._id,
            },
        ];
    }

    busySlots.forEach((slot, i) => {
        if (!skipSlot) {
            let busyStart = moment(slot.start).valueOf();
            let busyEnd = moment(slot.end).valueOf();

            if (busyStart <= start && busyEnd >= end) {
                skipSlot = true;
                noOfVotes = slot.noOfVotes;
                voters = slot.voters;
                _id = slot._id;
            } else if (busyStart <= start && busyEnd < end && busyEnd > start) {
                start = busyEnd;
            } else if (busyStart > start && busyStart < end && busyEnd >= end) {
                end = busyStart;
            } else if (busyStart > start && busyEnd < end) {
                let freeSlot = {
                    start: start,
                    end: busyStart,
                    startFormatted: moment(start).format("LLL"),
                    endFormatted: moment(busyStart).format("LLL"),
                    noOfVotes: slot.noOfVotes,
                    voters: slot.voters,
                    _id: slot._id,
                };
                freeSlots.push(freeSlot);
                start = busyEnd;
            }
        }
    });

    if (!skipSlot) {
        let freeSlot = {
            start: start,
            end: end,
            startFormatted: moment(start).format("LLL"),
            endFormatted: moment(end).format("LLL"),
            noOfVotes: noOfVotes,
            voters: voters,
            _id: _id,
        };
        freeSlots.push(freeSlot);
    }
    return freeSlots;
};
