import * as admin from 'firebase-admin';
import { appConfig } from './index';
import { logger } from '../utils/logger';

export const initializeFirebase = (): void => {
    try {
        if (admin.apps.length > 0) {
            return;
        }

        // In production/Google Cloud, simple initialization usually works if env vars are set properly
        // otherwise we might need serviceAccount credential
        if (appConfig.firebase.projectId && appConfig.firebase.clientEmail && appConfig.firebase.privateKey) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: appConfig.firebase.projectId,
                    clientEmail: appConfig.firebase.clientEmail,
                    privateKey: appConfig.firebase.privateKey.replace(/\\n/g, '\n'),
                }),
            });
            logger.info('Firebase Admin initialized with credentials');
        } else {
            admin.initializeApp();
            logger.info('Firebase Admin initialized with default application credentials');
        }

    } catch (error) {
        logger.error('Error initializing Firebase Admin:', error);
        // Don't crash for this, maybe just log, or throw?
        // throw error; 
    }
};
