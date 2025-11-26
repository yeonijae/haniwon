import { ReservationsState } from '../types';

export const findAvailableSlot = (
    currentDateKey: string,
    currentTime: string,
    actingNeeded: number,
    reservationState: ReservationsState,
    doctor: string,
    ignoreReservationId?: string
): { date: string, time: string, acting: number }[] => {
    let remainingActing = actingNeeded;
    const slots = [];
    let [hour, minute] = currentTime.split(':').map(Number);

    const getDateFromKey = (key: string) => {
        const [y, m, d] = key.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    let currentDay = getDateFromKey(currentDateKey);

    while (remainingActing > 0) {
        const timeKey = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

        const year = currentDay.getFullYear();
        const month = String(currentDay.getMonth() + 1).padStart(2, '0');
        const day = String(currentDay.getDate()).padStart(2, '0');
        const dayKey = `${year}-${month}-${day}`;

        let existingReservations = reservationState[dayKey]?.[doctor]?.[timeKey] || [];
        if(ignoreReservationId) {
            existingReservations = existingReservations.filter(r => r.id !== ignoreReservationId);
        }

        const usedActing = existingReservations.reduce((sum, r) => sum + r.slotActing, 0);
        const availableActing = 6 - usedActing;

        const actingToBook = Math.min(remainingActing, availableActing);

        if (actingToBook > 0) {
            slots.push({ date: dayKey, time: timeKey, acting: actingToBook });
            remainingActing -= actingToBook;
        }

        // Move to next 30-min slot
        minute += 30;
        if (minute >= 60) {
            hour++;
            minute = 0;
        }
        if (hour >= 20) { // End of day
            hour = 9;
            minute = 30;
            currentDay.setDate(currentDay.getDate() + 1); // Move to next day
        }
    }
    return slots;
};
