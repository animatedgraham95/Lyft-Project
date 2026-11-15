export const states = {
    REQUESTING: 'REQUESTING',
    MATCHED: 'MATCHED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    NO_DRIVER: 'NO_DRIVER',
    CANCELLED: 'CANCELLED',
};

const transitions = {
    driverMatched: {
        [states.REQUESTING]: states.MATCHED,
    },
    tripStarted: {
        [states.MATCHED]: states.IN_PROGRESS,
    },
    tripCompleted: {
        [states.IN_PROGRESS]: states.COMPLETED,
    },
    rideCancelled: {
        [states.REQUESTING]: states.CANCELLED,
        [states.MATCHED]: states.CANCELLED,
        [states.IN_PROGRESS]: states.CANCELLED,
    },
    noDriverFound: {
        [states.REQUESTING]: states.NO_DRIVER,
    },  
};



export function nextRideState (currentState,event){
    const nextState = transitions[event]?.[currentState];

    if(!nextState){
        throw new Error('Invalid transition: "${event}" from ${currentState}');
    }
    else{
        return nextState;
    }
}
const ride = { id: 1, status: states.REQUESTING };
ride.status = nextRideState(ride.status, 'driverMatched');