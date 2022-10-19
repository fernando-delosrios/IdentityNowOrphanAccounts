import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import {
    Context,
    ConnectorError,
    createConnector,
    readConfig,
    logger,
    Response,
    StdAccountCreateInput,
    StdAccountCreateOutput,
    StdAccountListOutput,
    StdAccountReadInput,
    StdAccountReadOutput,
    StdAccountUpdateInput,
    StdAccountUpdateOutput,
    StdEntitlementListOutput,
    StdEntitlementReadOutput,
    StdEntitlementReadInput,
    StdTestConnectionOutput,
    AttributeChangeOp,
    Key,
    SimpleKey,
} from '@sailpoint/connector-sdk'
import { IDNClient } from './idn-client'
import { Account } from './model/account'
import { Group } from './model/group'

// Connector must be exported as module property named connector
export const connector = async () => {
    // Get connector source config
    const config = await readConfig()

    // Use the vendor SDK, or implement own client as necessary, to initialize a client
    const client = new IDNClient(config)

    return createConnector()
        .stdTestConnection(async (context: Context, input: undefined, res: Response<StdTestConnectionOutput>) => {
            const response: AxiosResponse = await client.testConnection()
            if (response.status != 200) {
                throw new ConnectorError('Unable to connect to IdentityNow')
            } else {
                res.send({})
            }
        })
        .stdAccountList(async (context: Context, input: undefined, res: Response<StdAccountListOutput>) => {
            const response: AxiosResponse = await client.collectOrphanAccounts()
            for (const acc of response.data) {
                let account: Account = new Account(acc)
                console.log(account)
                res.send(account)
            }
        })
        .stdAccountCreate(
            async (context: Context, input: StdAccountCreateInput, res: Response<StdAccountCreateOutput>) => {
                logger.info(JSON.stringify(input))
                const response = await client.getIdentity(input.attributes.name)
                const id = response.data.pop().id
                await client.correlateAccount(id, input.attributes.id)
                const account: Account = {
                    identity: input.attributes.id,
                    uuid: input.attributes.name,
                    attributes: { name: input.attributes.name, id: input.attributes.id },
                }

                res.send(account)
            }
        )
        .stdAccountRead(async (context: Context, input: StdAccountReadInput, res: Response<StdAccountReadOutput>) => {
            logger.info(JSON.stringify(input))
            const response = await client.getAccount(input.identity)
            let account: Account = new Account(response.data)

            res.send(account)
        })
        .command('std:account:disable', async (context: Context, input: any, res: Response<any>) => {
            logger.info('std:account:disable')
            logger.info(JSON.stringify(input))
            await client.disableAccount(input.identity)
            const response = await client.getAccount(input.identity)
            let account = new Account(response.data)

            res.send(account)
        })
        .command('std:account:enable', async (context: Context, input: any, res: Response<any>) => {
            logger.info('std:account:enable')
            logger.info(JSON.stringify(input))
            await client.enableAccount(input.identity)
            const response = await client.getAccount(input.identity)
            let account = new Account(response.data)

            res.send(account)
        })
        .stdEntitlementList(async (context: Context, input: any, res: Response<StdEntitlementListOutput>) => {
            const response = await client.collectOrphanAccounts()
            const accessProfiles: string[] = []
            for (const gr of response.data) {
                let group: Group = new Group(gr)
                res.send(group)
            }
        })
        .stdEntitlementRead(
            async (context: Context, input: StdEntitlementReadInput, res: Response<StdEntitlementReadOutput>) => {
                logger.info(JSON.stringify(input))
                const response: AxiosResponse = await client.getAccount(input.identity)
                let group: Group = new Group(response.data)
                res.send(group)
            }
        )
        .stdAccountUpdate(
            async (context: Context, input: StdAccountUpdateInput, res: Response<StdAccountUpdateOutput>) => {
                logger.info(JSON.stringify(input))
                let response = await client.getAccount(input.identity)
                let account: Account = new Account(response.data)
                for (let change of input.changes) {
                    const values = [].concat(change.value)
                    for (let value of values) {
                        switch (change.op) {
                            case AttributeChangeOp.Add:
                                console.log('Skipping entitlement add request for orphan account')
                                break
                            case AttributeChangeOp.Remove:
                                await client.disableAccount(value)
                                break
                            default:
                                throw new ConnectorError(`Operation not supported: ${change.op}`)
                        }
                    }
                }
                response = await client.getAccount(input.identity)
                account = new Account(response.data)
                res.send(account)
            }
        )
}
