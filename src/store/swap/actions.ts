import { getLogger } from "../../util/logger";
import { ThunkCreator, SwapQuoteState, Token, StoreState } from "../../util/types";
import { CalculateSwapQuoteParams } from "../../util/types/swap";
import { getAssetSwapper } from "../../services/swap";
import { MarketSellSwapQuote, MarketBuySwapQuote } from "@0x/asset-swapper";
import { createAction } from "typesafe-actions";

const logger = getLogger('Store::Swap::Actions');

export const setSwapQuote = createAction('swap/QUOTE_set', resolve => {
    return (quote: MarketSellSwapQuote | MarketBuySwapQuote) => resolve(quote);
});

export const setSwapQuoteToken = createAction('swap/QUOTE_TOKEN_set', resolve => {
    return (token: Token) => resolve(token);
});

export const setSwapBaseToken = createAction('swap/BASE_TOKEN_set', resolve => {
    return (token: Token) => resolve(token);
});

export const setSwapQuoteState = createAction('swap/QUOTE_STATE_set', resolve => {
    return (quoteState: SwapQuoteState) => resolve(quoteState);
});


export const calculateSwapQuote: ThunkCreator = (params: CalculateSwapQuoteParams) => {
    return async (dispatch, getState) => {
        const state = getState();
        dispatch(setSwapQuoteState(SwapQuoteState.Loading))
        try {
            const assetSwapper = await getAssetSwapper();
            const quote = await assetSwapper.getSwapQuote(params);
            console.log(quote);
            dispatch(setSwapQuote(quote));
            dispatch(setSwapQuoteState(SwapQuoteState.Done))
        } catch (err) {
            console.log(err);
            logger.error(`error fetching quote.`, err);
            dispatch(setSwapQuoteState(SwapQuoteState.Error))
            return err;
        }
    };
};

export const changeSwapBaseToken: ThunkCreator = (token: Token) => {
    return async (dispatch, getState) => {
        const state = getState() as StoreState;
        dispatch(setSwapBaseToken(token));
       /* const knownTokens = getKnownTokens();
        try {
            const newQuoteToken = knownTokens.getTokenBySymbol(currencyPair.quote);
            dispatch(
                setMarketTokens({
                    baseToken: knownTokens.getTokenBySymbol(currencyPair.base),
                    quoteToken: newQuoteToken,
                }),
            );
            dispatch(setCurrencyPair(currencyPair));

            // if quote token changed, update quote price
            if (oldQuoteToken !== newQuoteToken) {
                try {
                    await dispatch(updateMarketPriceQuote());
                } catch (e) {
                    logger.error(`Failed to get Quote price`);
                }
            }
        } catch (e) {
            logger.error(`Failed to set token market ${e}`);
        }
        if (USE_RELAYER_MARKET_UPDATES) {
            // tslint:disable-next-line:no-floating-promises
            dispatch(fetchPastMarketFills());
            // tslint:disable-next-line:no-floating-promises
            dispatch(updateMarketStats());
        }

        // tslint:disable-next-line:no-floating-promises
        dispatch(getOrderbookAndUserOrders());

        const newSearch = queryString.stringify({
            ...queryString.parse(state.router.location.search),
            base: currencyPair.base,
            quote: currencyPair.quote,
        });

        dispatch(
            push({
                ...state.router.location,
                pathname: `${ERC20_APP_BASE_PATH}/`,
                search: newSearch,
            }),
        );*/
    };
};