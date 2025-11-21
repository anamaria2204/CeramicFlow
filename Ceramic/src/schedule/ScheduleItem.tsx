import React from 'react';
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonCardSubtitle, IonBadge, IonImg } from '@ionic/react';
import { Schedule } from './Schedule';

interface ScheduleItemProps {
    schedule: Schedule;
    onClick: () => void;
    currentStage?: string;
    photo?: string;
}

const ScheduleItem: React.FC<ScheduleItemProps> = ({ schedule, onClick, currentStage, photo }) => {
    return (
        <IonCard onClick={onClick} style={{ cursor: 'pointer' }}>
            {/* Display the photo if it exists */}
            {photo && (
                <IonImg src={photo} style={{ height: '150px', objectFit: 'cover' }} />
            )}
            <IonCardHeader>
                <IonCardTitle>{schedule.name}</IonCardTitle>
                <IonCardSubtitle>
                    {new Date(schedule.date).toLocaleDateString()} at {new Date(schedule.hour).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </IonCardSubtitle>
            </IonCardHeader>
            <IonCardContent>
                <p>Type: {schedule.objectType}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                    <IonBadge color={schedule.status === 'Scheduled' ? 'warning' : 'success'}>
                        {schedule.status}
                    </IonBadge>
                    {currentStage && <IonBadge color="medium">{currentStage}</IonBadge>}
                </div>
            </IonCardContent>
        </IonCard>
    );
};

export default ScheduleItem;