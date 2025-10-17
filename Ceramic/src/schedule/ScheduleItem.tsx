import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonBadge } from '@ionic/react';
import React from 'react';
import { Schedule } from './Schedule';

interface ScheduleProps {
    schedule: Schedule;
    onClick: () => void;
    currentStage?: string;
}

const ScheduleItem: React.FC<ScheduleProps> = ({ schedule, onClick, currentStage }) => {
    const dateObj = new Date(schedule.date);
    const hourObj = new Date(schedule.hour);

    return (
        <IonCard button={true} onClick={onClick} color="tertiary" className="ion-margin">
            <IonCardHeader>
                <IonCardTitle>{schedule.name}</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
                {currentStage && currentStage !== 'modeling' && (
                    <IonBadge color="success" style={{ marginBottom: '10px', textTransform: 'capitalize' }}>
                        Update: {currentStage}
                    </IonBadge>
                )}
                <p><strong>Date:</strong> {dateObj.toLocaleDateString()}</p>
                <p><strong>Hour:</strong> {hourObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                <p><strong>Object:</strong> {schedule.objectType}</p>
                <p><strong>Status:</strong> {schedule.status}</p>
            </IonCardContent>
        </IonCard>
    );
};

export default ScheduleItem;