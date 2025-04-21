import { Attributes, StdAccountReadOutput, logger } from '@sailpoint/connector-sdk'
import { Account } from 'sailpoint-api-client'

const TAG = 'Orphan account'

export class OrphanAccount implements StdAccountReadOutput {
    identity: string
    uuid: string
    attributes: Attributes
    disabled: boolean
    locked: boolean

    constructor(account: Account) {
        if (!account) {
            throw new Error('Account object cannot be null or undefined')
        }

        const accountName = account.name ?? '-'
        const accountId = account.id ?? '-'
        const sourceName = account.sourceName ?? 'Unknown Source'
        const isDisabled = account.disabled ?? false
        const isLocked = account.locked ?? false

        this.attributes = {
            tag: TAG,
            name: accountName,
            displayName: `${TAG}: ${accountName}`,
            id: accountId,
            description: `Source: ${sourceName}`,
            enabled: String(!isDisabled),
            locked: String(isLocked),
            source: sourceName,
        }

        this.locked = isLocked
        this.disabled = isDisabled
        this.identity = accountId
        this.uuid = this.attributes.displayName as string
    }
}
