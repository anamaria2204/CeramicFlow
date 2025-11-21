import { createAnimation } from '@ionic/react';

// Această animație va face Modalul să apară cu un efect de "Zoom In" (Scale)
export const modalEnterAnimation = (baseEl: HTMLElement) => {
    const root = baseEl.shadowRoot;

    const backdropAnimation = createAnimation()
        .addElement(root?.querySelector('ion-backdrop')!)
        .fromTo('opacity', '0.01', 'var(--backdrop-opacity)');

    const wrapperAnimation = createAnimation()
        .addElement(root?.querySelector('.modal-wrapper')!)
        .keyframes([
            { offset: 0, opacity: '0', transform: 'scale(0)' },
            { offset: 1, opacity: '0.99', transform: 'scale(1)' }
        ]);

    return createAnimation()
        .addElement(baseEl)
        .easing('ease-out')
        .duration(300) // Durata animației în ms
        .addAnimation([backdropAnimation, wrapperAnimation]);
};

export const modalLeaveAnimation = (baseEl: HTMLElement) => {
    return modalEnterAnimation(baseEl).direction('reverse');
};