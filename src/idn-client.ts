import { ConnectorError, StdTestConnectionOutput } from '@sailpoint/connector-sdk'
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { Group } from './model/group'

export class IDNClient {
    private readonly idnUrl: string
    private readonly patId: string
    private readonly patSecret: string
    private readonly includedSources: string[]
    readonly application: string | null
    private accessToken?: string
    private expiryDate: Date

    constructor(config: any) {
        this.idnUrl = config.idnUrl
        this.patId = config.patId
        this.patSecret = config.patSecret
        this.expiryDate = new Date()
        this.includedSources = config.includedSources.split(',').map((x: string) => x.trim())
        this.application = config.application
    }

    async getAccessToken(): Promise<string | undefined> {
        if (new Date() >= this.expiryDate) {
            const request: AxiosRequestConfig = {
                method: 'post',
                baseURL: this.idnUrl,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                params: {
                    client_id: this.patId,
                    client_secret: this.patSecret,
                    grant_type: 'client_credentials',
                },
                url: '/oauth/token',
            }
            const response: AxiosResponse = await axios(request)
            this.accessToken = response.data.access_token
            this.expiryDate = new Date()
            this.expiryDate.setSeconds(this.expiryDate.getSeconds() + response.data.expires_in)
        }

        return this.accessToken
    }

    async testConnection(): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()

        let request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.idnUrl,
            url: '/beta/public-identities-config',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        }

        return axios(request)
    }

    async getIncludedSourcesQuery(): Promise<string> {
        const accessToken = await this.getAccessToken()
        const LIMIT = 250
        const query = this.includedSources.map((x) => `name eq "${x}"`).join(' or ')

        let request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.idnUrl,
            url: '/v3/sources',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
            params: {
                filters: query,
                count: true,
                limit: LIMIT,
                offset: 0,
            },
        }

        const response = await axios(request)

        return response.data.map((x: any) => `sourceId eq "${x.id}"`).join(' or ')
    }

    async collectOrphanAccounts(): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()
        const LIMIT = 250
        const sourcesQuery = await this.getIncludedSourcesQuery()

        let request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.idnUrl,
            url: '/beta/accounts',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            params: {
                filters: `uncorrelated eq true and (${sourcesQuery})`,
                count: true,
                limit: LIMIT,
                offset: 0,
            },
        }

        let data: any[] = []
        let finished = false

        let response = await axios(request)

        while (!finished) {
            if (LIMIT + request.params.offset < parseInt(response.headers['x-total-count'])) {
                request.params.offset += LIMIT
                response = await axios(request)
                data = [...data, ...response.data]
                response.data = data
            } else {
                finished = true
            }
        }

        return response
    }

    async getAccount(id: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()

        let request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.idnUrl,
            url: `/beta/accounts/${id}`,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        }

        return await axios(request)
    }

    async correlateAccount(id: string, account: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()

        let request: AxiosRequestConfig = {
            method: 'patch',
            baseURL: this.idnUrl,
            url: `/beta/accounts/${account}`,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json-patch+json',
                Accept: 'application/json',
            },
            data: [
                {
                    op: 'replace',
                    path: '/identityId',
                    value: id,
                },
            ],
        }

        return await axios(request)
    }

    async enableAccount(id: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()

        let request: AxiosRequestConfig = {
            method: 'post',
            baseURL: this.idnUrl,
            url: `/beta/accounts/${id}/enable`,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            data: {
                forceProvisioning: true,
            },
        }

        return await axios(request)
    }

    async disableAccount(id: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()

        let request: AxiosRequestConfig = {
            method: 'post',
            baseURL: this.idnUrl,
            url: `/beta/accounts/${id}/disable`,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            data: {
                forceProvisioning: true,
            },
        }

        return await axios(request)
    }

    async getIdentity(name: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()

        let request: AxiosRequestConfig = {
            method: 'post',
            baseURL: this.idnUrl,
            url: '/v3/search',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            params: {
                limit: 1,
            },
            data: {
                query: {
                    query: `name.exact:"${name}"`,
                },
                indices: ['identities'],
                includeNested: false,
                queryResultFilter: {
                    includes: ['id'],
                },
            },
        }

        return await axios(request)
    }
}
