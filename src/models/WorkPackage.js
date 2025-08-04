/**
 * Represents a Work-Package (P), the atomic unit of intent.
 * Formally defined in Section 14.3 of the graypaper.
 */
// Re-using WorkPackage from Phase 1
import { validateRequired, validateType, validateArrayOfType, validateInstanceOf } from '../utils/validator.js';
import { WorkItem } from './WorkItem.js';

export class WorkPackage {
    /**
     * @param {string} authorizationToken - Authorization token (j).
     * @param {object} authorizationServiceDetails - Details of the authorization service (h, u, f).
     * @param {string} authorizationServiceDetails.h - Host.
     * @param {string} authorizationServiceDetails.u - URL.
     * @param {string} authorizationServiceDetails.f - Function.
     * @param {string} context - Context (c).
     * @param {WorkItem[]} workItems - Sequence of one or more Work-Items (w).
     */
    constructor(authorizationToken, authorizationServiceDetails, context, workItems) {
        validateRequired(authorizationToken, 'Authorization Token');
        validateType(authorizationToken, 'Authorization Token', 'string');

        validateRequired(authorizationServiceDetails, 'Authorization Service Details');
        validateType(authorizationServiceDetails, 'Authorization Service Details', 'object');
        validateRequired(authorizationServiceDetails.h, 'Auth Service Host');
        validateType(authorizationServiceDetails.h, 'Auth Service Host', 'string');
        validateRequired(authorizationServiceDetails.u, 'Auth Service URL');
        validateType(authorizationServiceDetails.u, 'Auth Service URL', 'string');
        validateRequired(authorizationServiceDetails.f, 'Auth Service Function');
        validateType(authorizationServiceDetails.f, 'Auth Service Function', 'string');

        validateRequired(context, 'Context');
        validateType(context, 'Context', 'string');

        validateArrayOfType(workItems, 'Work Items', 'object'); // Will validate instances below
        if (workItems.length === 0) {
            throw new Error('Work-Package must contain at least one Work-Item.');
        }
        for (const item of workItems) {
            validateInstanceOf(item, 'Work Item', WorkItem);
        }

        this.authorizationToken = authorizationToken;
        this.authorizationServiceDetails = authorizationServiceDetails;
        this.context = context;
        this.workItems = workItems;
    }

    /**
     * Converts the WorkPackage to a plain object for serialization.
     * @returns {object}
     */
    toObject() {
        return {
            authorizationToken: this.authorizationToken,
            authorizationServiceDetails: this.authorizationServiceDetails,
            context: this.context,
            workItems: this.workItems.map(item => item.toObject()),
        };
    }
}