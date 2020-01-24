import { BigNumber, NULL_BYTES } from '@0x/utils';
import React from 'react';
import { connect } from 'react-redux';
import styled, { keyframes } from 'styled-components';

import { ZERO } from '../../../common/constants';
import { fetchTakerAndMakerFee } from '../../../store/relayer/actions';
import { getQuoteInUsd, getSwapQuoteState, getEthInUsd, getTokensPrice } from '../../../store/selectors';
import { getKnownTokens } from '../../../util/known_tokens';

import { formatTokenSymbol, tokenAmountInUnits, tokenSymbolToDisplayString } from '../../../util/tokens';
import { OrderFeeData, OrderSide, StoreState, Token, SwapQuoteState, TokenPrice } from '../../../util/types';
import { MarketBuySwapQuote, MarketSellSwapQuote } from '@0x/asset-swapper';
import { getMarketPriceEther } from '../../../services/markets';


const Row = styled.div`
    align-items: center;
    border-top: dashed 1px ${props => props.theme.componentsTheme.borderColor};
    display: flex;
    justify-content: space-between;
    padding: 12px 0;
    position: relative;
    z-index: 1;

    &:last-of-type {
        margin-bottom: 20px;
    }
`;

const Value = styled.div`
    color: ${props => props.theme.componentsTheme.textColorCommon};
    flex-shrink: 0;
    font-feature-settings: 'tnum' 1;
    font-size: 14px;
    line-height: 1.2;
    white-space: nowrap;
`;

const CostValue = styled(Value)`
    font-feature-settings: 'tnum' 1;
    font-weight: bold;
`;

const LabelContainer = styled.div`
    align-items: flex-end;
    display: flex;
    justify-content: space-between;
    margin: 5px 0 10px 0;
`;

const Label = styled.label<{ color?: string }>`
    color: ${props => props.color || props.theme.componentsTheme.textColorCommon};
    font-size: 14px;
    font-weight: 500;
    line-height: normal;
    margin: 0;
`;

const MainLabel = styled(Label)``;

const FeeLabel = styled(Label)`
    color: ${props => props.theme.componentsTheme.textColorCommon};
    font-weight: normal;
`;

const CostLabel = styled(Label)`
    font-weight: 700;
`;

const Wave = styled.div`
`;

const WaveKeyframe = keyframes`
    0%, 60%, 100% {
        transform: initial;
    }
    30% {
        transform: translateY(-15px);
    }
`
const Dot = styled.span`
        color: ${props => props.theme.componentsTheme.textColorCommon};
        background-color: ${props => props.theme.componentsTheme.textColorCommon};
    	display:inline-block;
		width:12px;
		height:12px;
		border-radius:50%;
		margin-right:3px;
		background: ${props => props.theme.componentsTheme.textColorCommon};
		animation: ${WaveKeyframe} 1.3s linear infinite;

		&:nth-child(2) {
			animation-delay: -1.1s;
		}

		&:nth-child(3) {
			animation-delay: -0.9s;
		}
`

const AnimatedDots = () =>
    <Wave>
        <Dot />
        <Dot />
        <Dot />
    </Wave>



interface OwnProps {
    tokenAmount: BigNumber;
    tokenPrice: BigNumber;
    orderSide: OrderSide;
    quoteToken: Token;
    baseToken: Token;
    quote?: MarketBuySwapQuote | MarketSellSwapQuote;
}

interface StateProps {
    qouteInUSD: BigNumber | undefined | null;
    quoteState: SwapQuoteState;
    tokenPrices: TokenPrice[] | null;
}

interface DispatchProps {
    onFetchTakerAndMakerFee: (amount: BigNumber, price: BigNumber, side: OrderSide) => Promise<OrderFeeData>;
}

type Props = StateProps & OwnProps & DispatchProps;

interface State {
    makerFeeAmount: BigNumber;
    takerFeeAmount: BigNumber;
    makerFeeAssetData?: string;
    takerFeeAssetData?: string;
    canOrderBeFilled?: boolean;
    quoteTokenAmount: BigNumber;
    price: BigNumber;
    geckoPrice?: BigNumber;
}

class MarketTradeDetails extends React.Component<Props, State> {
    public state = {
        makerFeeAmount: ZERO,
        takerFeeAmount: ZERO,
        makerFeeAssetData: NULL_BYTES,
        takerFeeAssetData: NULL_BYTES,
        quoteTokenAmount: ZERO,
        canOrderBeFilled: true,
        price: ZERO,
        geckoPrice: ZERO,
    };

    public componentDidUpdate = async (prevProps: Readonly<Props>) => {
        const newProps = this.props;
        if (
            newProps.tokenPrice !== prevProps.tokenPrice ||
            newProps.tokenAmount !== prevProps.tokenAmount ||
            newProps.quote !== prevProps.quote ||
            newProps.orderSide !== prevProps.orderSide ||
            newProps.quoteState !== prevProps.quoteState
        ) {
            if (newProps.quoteState === SwapQuoteState.Done) {
                await this._updateOrderDetailsState();
            }
        }
    };

    public componentDidMount = async () => {
        await this._updateOrderDetailsState();
    };

    public render = () => {
        const fee = this._getFeeStringForRender();
        const cost = this._getCostStringForRender();
        const costText = this._getCostLabelStringForRender();
        const priceMedianText = this._getMedianPriceStringForRender();
        const priceMarketTrackerText = this._getPriceMarketRender();

        return (
            <>
                <LabelContainer>
                    <MainLabel>Order Details</MainLabel>
                </LabelContainer>
                <Row>
                    <FeeLabel>Fee</FeeLabel>
                    <Value>{fee}</Value>
                </Row>
                <Row>
                    <CostLabel>{costText}</CostLabel>
                    <CostValue>{cost}</CostValue>
                </Row>
                <Row>
                    <CostLabel>Median Price:</CostLabel>
                    <CostValue>{priceMedianText}</CostValue>
                </Row>
                <Row>
                    <CostLabel>Price by Coingecko:</CostLabel>
                    <CostValue>{priceMarketTrackerText}</CostValue>
                </Row>
            </>
        );
    };

    private readonly _updateOrderDetailsState = async () => {
        const { quote, orderSide, tokenAmount, baseToken, quoteToken, tokenPrices } = this.props;
        if (!quote) {
            this.setState({ canOrderBeFilled: false });
            return;
        }
      
        const isSell = orderSide === OrderSide.Sell;
        const bestQuote = quote.bestCaseQuoteInfo;

        // HACK(dekz): we assume takerFeeAssetData is either empty or is consistent through all orders         
        const takerFeeAssetData = quote.takerAssetData;
        const takerFeeAmount = bestQuote.feeTakerAssetAmount;
        const quoteTokenAmount = isSell ? bestQuote.makerAssetAmount : bestQuote.takerAssetAmount;
        const baseTokenAmount = isSell ? bestQuote.takerAssetAmount :  bestQuote.makerAssetAmount;
        if(!baseTokenAmount.isEqualTo(tokenAmount)){
            return;
        }
        const quoteTokenAmountUnits = new BigNumber(tokenAmountInUnits(quoteTokenAmount, quoteToken.decimals, 18));
        const baseTokenAmountUnits = new BigNumber(tokenAmountInUnits(tokenAmount, baseToken.decimals, 18));
        const price = quoteTokenAmountUnits.div(baseTokenAmountUnits);
        let geckoPrice;
        if(tokenPrices){
            const tokenPriceQuote = tokenPrices.find(t=> t.c_id === quoteToken.c_id);
            const tokenPriceBase = tokenPrices.find(t=> t.c_id === baseToken.c_id);
            if(tokenPriceQuote && tokenPriceBase){
              geckoPrice = tokenPriceBase.price_usd.div(tokenPriceQuote.price_usd);
            }
         }

        this.setState({
            takerFeeAmount,
            takerFeeAssetData,
            quoteTokenAmount,
            canOrderBeFilled: true,
            price,
            geckoPrice,
        });

    };

    private readonly _getFeeStringForRender = () => {
        const { takerFeeAmount, takerFeeAssetData } = this.state;
        const { quoteState } = this.props;
        // If its a Limit order the user is paying a maker fee
        const feeAssetData = takerFeeAssetData;
        const feeAmount = takerFeeAmount;
        if (quoteState === SwapQuoteState.Loading) {
            return <AnimatedDots />
        }

        if (feeAssetData === NULL_BYTES) {
            return '0.00';
        }
        const feeToken = getKnownTokens().getTokenByAssetData(feeAssetData);

        return `${tokenAmountInUnits(
            feeAmount,
            feeToken.decimals,
            feeToken.displayDecimals,
        )} ${tokenSymbolToDisplayString(feeToken.symbol)}`;
    };

    private readonly _getCostStringForRender = () => {
        const { canOrderBeFilled } = this.state;
        const {  quoteToken, quoteState, tokenPrices } = this.props;
        if (quoteState === SwapQuoteState.Loading) {
            return <AnimatedDots />
        }

        if (!canOrderBeFilled) {
            return `---`;
        }
        let quoteInUSD;
        if(tokenPrices){
            const tokenPrice = tokenPrices.find(t=> t.c_id === quoteToken.c_id);
            if(tokenPrice){
                quoteInUSD = tokenPrice.price_usd;
            }
        }

        const { quoteTokenAmount } = this.state;
        const quoteTokenAmountUnits = tokenAmountInUnits(quoteTokenAmount, quoteToken.decimals);
        const costAmount = tokenAmountInUnits(quoteTokenAmount, quoteToken.decimals, quoteToken.displayDecimals);
        if (quoteInUSD) {
            const quotePriceAmountUSD = new BigNumber(quoteTokenAmountUnits).multipliedBy(quoteInUSD);
            return `${costAmount} ${formatTokenSymbol(quoteToken.symbol)} (${quotePriceAmountUSD.toFixed(2)} $)`;
        } else {
            return `${costAmount} ${formatTokenSymbol(quoteToken.symbol)}`;
        }
    };
    private readonly _getMedianPriceStringForRender = () => {
        const { canOrderBeFilled, price } = this.state;

        const { tokenAmount, quoteToken, quoteState } = this.props;

        if (quoteState === SwapQuoteState.Loading) {
            return <AnimatedDots />
        }
        if (!canOrderBeFilled) {
            return `---`;
        }
        if (tokenAmount.eq(0)) {
            return `---`;
        }
        const priceDisplay = price.toFormat(8);
        return `${priceDisplay} ${formatTokenSymbol(quoteToken.symbol)}`;
    };

    private readonly _getCostLabelStringForRender = () => {
        const { qouteInUSD, orderSide } = this.props;
        if (qouteInUSD) {
            return orderSide === OrderSide.Sell ? 'Estimated Total (USD)' : 'Estimated Cost (USD)';
        } else {
            return orderSide === OrderSide.Sell ? 'Estimated Total' : 'Estimated Cost';
        }
    };
    private readonly _getPriceMarketRender = () => {
         const { quoteToken, quoteState } = this.props;
         const {geckoPrice} = this.state;

         if (quoteState === SwapQuoteState.Loading) {
            return <AnimatedDots />
          }
         if(geckoPrice.gt(0)){
               return `${geckoPrice.toFormat(8)} ${formatTokenSymbol(quoteToken.symbol)}`;
        }         
         return '---'
    };
}

const mapStateToProps = (state: StoreState): StateProps => {
    return {
        qouteInUSD: getQuoteInUsd(state),
        quoteState: getSwapQuoteState(state),
        tokenPrices: getTokensPrice(state),
    };
};

const mapDispatchToProps = (dispatch: any): DispatchProps => {
    return {
        onFetchTakerAndMakerFee: (amount: BigNumber, price: BigNumber, side: OrderSide) =>
            dispatch(fetchTakerAndMakerFee(amount, price, side, side)),
    };
};

const MarketTradeDetailsContainer = connect(mapStateToProps, mapDispatchToProps)(MarketTradeDetails);

export { CostValue, MarketTradeDetails, MarketTradeDetailsContainer, Value };