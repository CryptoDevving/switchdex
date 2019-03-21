import { HttpClient, SignedOrder } from '@0x/connect';

import { RELAYER_URL } from '../common/constants';

export class Relayer {
    public readonly client: HttpClient;

    constructor(client: HttpClient) {
        this.client = client;
    }

    public async getAllOrdersAsync(baseTokenAssetData: string, quoteTokenAssetData: string): Promise<SignedOrder[]> {
        const [sellOrders, buyOrders] = await Promise.all([
            this._getOrdersAsync(baseTokenAssetData, quoteTokenAssetData),
            this._getOrdersAsync(quoteTokenAssetData, baseTokenAssetData),
        ]);

        return [...sellOrders, ...buyOrders];
    }

    public async getUserOrdersAsync(
        account: string,
        baseTokenAssetData: string,
        quoteTokenAssetData: string,
    ): Promise<SignedOrder[]> {
        const [sellOrders, buyOrders] = await Promise.all([
            this._getOrdersAsync(baseTokenAssetData, quoteTokenAssetData, account),
            this._getOrdersAsync(quoteTokenAssetData, baseTokenAssetData, account),
        ]);

        return [...sellOrders, ...buyOrders];
    }

    private async _getOrdersAsync(
        makerAssetData: string,
        takerAssetData: string,
        makerAddress?: string,
    ): Promise<SignedOrder[]> {
        const recordsToReturn: SignedOrder[] = [];
        const requestOpts = {
            makerAssetData,
            takerAssetData,
            makerAddress,
        };

        let hasMorePages = true;
        let page = 1;

        while (hasMorePages) {
            const { total, records, perPage } = await this.client.getOrdersAsync({
                ...requestOpts,
                page,
            });
            recordsToReturn.push.apply(
                recordsToReturn,
                records.map(apiOrder => {
                    return apiOrder.order;
                }),
            );

            page += 1;
            const lastPage = Math.ceil(total / perPage);
            hasMorePages = page <= lastPage;
        }
        return recordsToReturn;
    }
}

let relayer: Relayer;
export const getRelayer = (): Relayer => {
    if (!relayer) {
        const client = new HttpClient(RELAYER_URL);
        relayer = new Relayer(client);
    }

    return relayer;
};
