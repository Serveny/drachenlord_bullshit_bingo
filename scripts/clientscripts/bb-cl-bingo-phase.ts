import { GameCache } from './bb-cl-game-cache';
import { Room } from './bb-cl-room';

export class BingoPhase {

  constructor() {
  }

  startBingoPhase(roomArr: any) {
    const _self = this;
    GameCache.matchfield.cardsFlipAnimation().then(function() {
      _self.addEventsBingoPhase();
      _self.socketAddEventsBingoPhase();
    });
    GameCache.barButtons.autofillBtn.hide();
    GameCache.room = new Room(roomArr);

    $('#bb_cardsContainer').append(
      GameCache.room.roomBuildOtherFieldsHTML()
    );
    $('#bb_countdownContainer').fadeOut(800);
    $('.bb_userReady').hide();
    $('.bb_userField').addClass('bb_userField_Clickable');
    GameCache.darkMode.repaint();
  }
  
  addEventsBingoPhase() {
    const _self = this,
      documentClickHandler = function(e: any) {
        let target = $(e.target);

        // Userfield Click Handler
        target =
          target.parent().hasClass('bb_userField') === true
            ? target.parent()
            : target;
        if (target.hasClass('bb_userField') === true) {
          if (target.hasClass('bb_userSelected') === false) {
            GameCache.room.roomSelectCardField(target.attr('data-player-id'));
          }
          return;
        }

        // Card Click Handler
        target = target.hasClass('bb_card_text') === true ? target.parent() : target;
        if (target.hasClass('bb_cardHit') === true) {
          return;
        }
        if (target.hasClass('bb_card') === true) {
          if (GameCache.selectedCardsGrid.attr('data-player-id') === GameCache.thisPlayerId) {
            if (GameCache.matchfield.cardChangeEl != null) {
              const id = target.attr('data-card-id');
              if (id !== GameCache.matchfield.cardChangeEl.attr('data-card-id')) {
                GameCache.matchfield.cardsRemoveConfirmBox(GameCache.matchfield.cardChangeEl);
                GameCache.matchfield.cardsAddConfirmBox(target);
              }
            } else {
              GameCache.matchfield.cardsAddConfirmBox(target);
            }
          }
        } else {
          if (GameCache.matchfield.cardChangeEl != null) {
            GameCache.matchfield.cardsRemoveConfirmBox(GameCache.matchfield.cardChangeEl);
          }
        }
      };

    $(document).on('click', documentClickHandler);
  }

  socketAddEventsBingoPhase() {
    const _self = this,
      cardHitHandler = function(data: any) {
        GameCache.matchfield.cardsSetHit(data.playerId, data.cardId, data.isHit);
      },
      playerLaterBingoPhase = function(data: any) {
        // TODO
      };

    GameCache.socket.on('cardHit', cardHitHandler);

    GameCache.socket.on('playerLaterBingoPhase', playerLaterBingoPhase);

    GameCache.socket.on('playerWin', winData => {
      console.log(
        '[GAME END] ',
        winData.playerId,
        $('.bb_cardsGrid[data-selected="true"]').attr('data-player-id')
      );
      if (
        winData.playerId ===
        $('.bb_cardsGrid[data-selected="true"]').attr('data-player-id')
      ) {
        GameCache.matchfield.drawWinLine(winData.winLine);
        GameCache.matchfield.playWinAnimation();
        GameCache.socket.off('cardHit', cardHitHandler);
      } else {
        GameCache.matchfield.playOtherPlayerWinAnimation(winData.playerId);
        console.log('Other player won');
      }
    });
  }
}