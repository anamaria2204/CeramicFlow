export interface CeramicObject {
    id: string;
    scheduleId: string;
    name: string;
    creationDate: string;
    currentStage: 'modeling' | 'drying' | 'firing' | 'painting' | 'glazing' | 'finished';
    remindersScheduled: boolean;
}