// Derjeniche, der den Code schreibt:
// Serveny

class Room {
    constructor(room) {
        this.id = room.id;
        this.playerMap = new Map();
        this.phase = room.phase;

        const _self = this;
        room.playerMap.forEach(function(player) {
            _self.playerMap.set(player[0], new Player(player[1]));
        });            
    }
}

class Player {
    constructor(player) {
        this.id = player.id;
        this.avatar = player.avatar;
        this.isReady = player.isReady;
        this.cardMap = new Map();

        const _self = this;
        player.cardMap.forEach(function(card) {
            _self.cardMap.set(card[0], new Card(card[1]));
        });
    }
}

class Card {
    constructor(card) {
        this.id = card.id;
        this.word = card.word == null ? null : new Word(card.word);
        this.posX = card.posX;
        this.posY = card.posY;
    }
}

class Word {
    constructor(word) {
        this.id = word.id;
        this.text = word.text;
        this.countGuessed = word.countGuessed;
        this.countUsed = word.countUsed;
        this.createdAt = word.createdAt;
        this.changedAt = word.changedAt;
    }
}

class WinklerBingo {

    // A bisl wergeln & rumwuseln
    constructor () {
        this.socket = io.connect(window.location.host);
        this.roomId = this.getUrlParam('r');
        this.room = {};
        this.barBtns = {
            autofillBtn:   $('#wB_autofillBtn'),
            toggleInfoBtn: $('.wB_toggleInfoBtn'),
            toggleDarkBtn: $('#wB_toggleDarkBtn'),
            leaveRoomBtn:  $('#wB_leaveRoomBtn'),
        };
        this.selectedCardsGrid = $('.wB_cardsGrid[data-selected=true]');
        this.socketAddEvents();

        // Dark Mode
        if (this.getDarkModeSetting() === true) {
            this.toggleDarkMode();
        } else {
            $('body').css({'background': '#F2E2C4'});
        }

        this.addEvents();

        if (this.roomId != null) {
            this.socket.emit('joinRoom', this.roomId);
        }
    }

    startWerkelPhase(room) {
        this.room = new Room(room);
        console.debug('RoomJoinedCache: ', this.room);

        // Brobbaties
        const urlWithoutParams =  location.protocol + '//' + location.host;
        this.cardChange = null;
        this.nextFocusCardId = null;
        this.isDarkMode = false;
        this.isInfoOpen = false;
        this.cards = [];
        this.phase = 0;

        // Lobby
        history.pushState(null, '', urlWithoutParams + '?r=' + this.room.id);

        $('#wB_createRoomBtn').hide();
        $('#wB_lobbyContainer').fadeIn(1600);

        this.roomAddPlayer(this.room.playerMap);

        // Hadde Arbeit
        this.buildCardsHTML('middle');

        // Dark Mode
        if (this.getDarkModeSetting() === true) {
            this.toggleDarkMode();
        }

        const removeEventsWerkelPhase = this.addEventsWerkelPhase();
        this.socketAddEventsWerkelPhase(removeEventsWerkelPhase);

        $('#wB_cardsContainer').fadeIn(800);
        this.barBtns.leaveRoomBtn.fadeIn(800);
        this.barBtns.autofillBtn.fadeIn(800);
    }

    // 20.08 Schanzenfest
    addEvents() {
        const _self = this;

        $('#wB_createRoomBtn').click(function() {
            _self.socket.emit('joinRoom', null);
        });

        _self.barBtns.toggleDarkBtn.click(function() {
            _self.toggleDarkMode();    
        });

        _self.barBtns.toggleInfoBtn.click(function() {
            _self.toggleInfo();    
        });

        this.barBtns.leaveRoomBtn.click(function() {
            _self.socket.disconnect();
            history.pushState(null, '', location.protocol + '//' + location.host);
            location.reload();
        });

        _self.barBtns.autofillBtn.click(function() {
            _self.socket.emit('needAutofill', _self.cardsGetTextArr());
        });
    }

    socketAddEvents() {
        const _self = this;

        _self.socket.on('gameError', function(errorStr) {
            console.log('[SERVERERROR] ' + errorStr);
            _self.showErrorToast(errorStr);
        });

        _self.socket.on('disconnect', function() {
            // TODO Connection lost handling
            console.log(_self.socket.id + ' disconnected');
        });

        _self.socket.on('roomJoined', function (roomData) {
            if (roomData == null) {
                history.pushState(null, '', location.protocol + '//' + location.host);
                $('#wB_createRoomBtn').show();
            } else {
                _self.startWerkelPhase(roomData);
            }
        });

        _self.socket.on('playerJoined', function (newPlayer) {
            _self.roomUnreadyPlayer(_self.room.playerMap);
            newPlayer = new Player(newPlayer);
            _self.room.playerMap.set(newPlayer.id, newPlayer);
            _self.roomAddPlayerHTML(newPlayer);

            if (_self.countdownId != null) {
                _self.roomStopCountdown();
            }
        });

        _self.socket.on('playerDisconnected', function (playerId) {
            _self.roomUnreadyPlayer(_self.room.playerMap);
            _self.roomRemovePlayerHTML(playerId);
        });

        _self.socket.on('nameChanged', function (data) {
            _self.roomPlayerChangeName(data.playerId, data.name);
        });
    }    

    socketAddEventsWerkelPhase(removeEventsWerkelPhaseFunc) {
        const _self = this,
        playerIsReadyChangedHandler = function (data) {
            _self.roomSetPlayerReadyHTML(data.playerId, data.isReady);

            if (data.isReady === false) {
                _self.roomStopCountdown();
            }
        },
        autofillResultHandler = function (changedCardsArr) {
            _self.cardsAutofill(_self.arrToCardMap(changedCardsArr));
        },
        cardValidationResultHandler = function (card) {
            if (card != null) {
                _self.cardsSetCard(new Card(card));
            } else {
                _self.shakeAndStay(_self.cardChange);
            }
        },
        startCountdownHandler = function (timeMS) {
            _self.roomStartCountdown(timeMS);
        },
        phaseChangedToBingoHandler = function (playRoom) {
            console.log('phaseChangedToBingoHandler', playRoom);
            removeEventsWerkelPhaseFunc();

            // Sogge uffräume
            _self.socket.off('playerIsReadyChanged', playerIsReadyChangedHandler);
            _self.socket.off('autofillResult', autofillResultHandler);
            _self.socket.off('cardValidationResult', cardValidationResultHandler);
            _self.socket.off('startCountdown', startCountdownHandler);
            _self.socket.off('phaseChangedToBingo', phaseChangedToBingoHandler);

            _self.roomStartBingoPhase(playRoom);
        }

        _self.socket.on('playerIsReadyChanged', playerIsReadyChangedHandler);
        _self.socket.on('autofillResult', autofillResultHandler);
        _self.socket.on('cardValidationResult', cardValidationResultHandler);
        _self.socket.on('startCountdown', startCountdownHandler);
        _self.socket.on('phaseChangedBingo', phaseChangedToBingoHandler);
    }

    // Returns function to remove in function setted eventhandler
    addEventsWerkelPhase() {
        const _self = this,
        keydownHandler = function(e) {
            let keyCode = e.keyCode || e.which;

            // Key: Tab
            if (keyCode == 9) {
                if (_self.cardChange != null) {
                    e.preventDefault();
                    let number = _self.cardChange.attr('data-id');
                    
                    if(e.shiftKey) {
                        number--;
                    } else {
                        number++;
                    }

                    _self.nextFocusCardId = number;
                    _self.cardsSetNewTextToCard(_self.cardChange);
                }
            } 
            
            // Key: Enter
            if(keyCode == 13) {
                if (_self.cardChange != null) {
                    e.preventDefault();
                    _self.cardsSetNewTextToCard(_self.cardChange);
                }
            }

            // Key: Esc
            if (keyCode == 27) {
                if (_self.cardChange != null) {
                    e.preventDefault();
                    _self.cardsRevertCard(_self.cardChange);
                }
                if (_self.isInfoOpen === true) {
                    _self.toggleInfo();
                }
            }
        },
        documentClickHandler = function(e) {
            let target = $(e.target);
            target = target.hasClass('wB_card_text') === true ? target.parent() : target;

            if (target.hasClass('wB_card') === true) {
                const id = target.attr('data-id');
                if (_self.cardChange != null) {
                    if (id !== _self.cardChange.attr('data-id')) {
                        _self.nextFocusCardId = id;
                        _self.cardsSetNewTextToCard(_self.cardChange);
                    }
                } else {
                    _self.cardsAddTextArea(target);
                }
            } else {
                if (_self.cardChange != null) {
                    _self.cardsSetNewTextToCard(_self.cardChange);
                }
            }
        },
        removeEventsWerkelPhase = function() {
            $(document).off('keydown', keydownHandler);
            $(document).off('click', documentClickHandler);
        };

        $(document).on('keydown', keydownHandler);
        $(document).on('click', documentClickHandler);
        return removeEventsWerkelPhase;
    }

    addEventsBingoPhase() {
        const _self = this,
        documentClickHandler = function(e) {
            let target = $(e.target);
            target = target.hasClass('wB_card_text') === true ? target.parent() : target;

            if (target.hasClass('wB_card') === true) {
                const id = target.attr('data-id');
                if (_self.cardChange != null) {
                    if (id !== _self.cardChange.attr('data-id')) {
                        _self.cardsRemoveConfirmBox(_self.cardChange);
                        _self.cardsAddConfirmBox(target);
                    }
                } else {
                    _self.cardsAddConfirmBox(target);
                }
            } else {
                if (_self.cardChange != null) {
                    _self.cardsRemoveConfirmBox(_self.cardChange);
                }
            }
        }

        $(document).on('click', documentClickHandler);
    }

    // HTML-Code positionieren, so a richtig geilen DOM
    buildCardsHTML() {
        let fieldHTML = '';
        let count = 0;
        
        for (let i = 1; i < 6; i++) {
            for (let u = 1; u < 6; u++) {
                this.cards[++count] = {
                    text: '',
                    x: i,
                    y: u
                };
                fieldHTML += '<div class="wB_card" data-x="' + i + '" data-y="' + u + '" data-id="' + count + '" style="grid-row: ' + i + '; grid-column: ' + u + ';">' +
                '<span class="wB_card_text"></span>' +
                '</div>';
            }
        }

        this.selectedCardsGrid.html(fieldHTML);
    }

    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;

        if (this.isDarkMode === true) {
            this.setDarkModeSetting(true);
            $('body').addClass('dark');
            $('.wB_card').addClass('dark');
            $('#wB_info').addClass('dark');
            $('#bodyOverlay').css('opacity', 0.6);
            $('.wB_cardBtn').addClass('cardBtnDark');
        } else {
            this.setDarkModeSetting(false);
            $('body').css({'background': '#F2E2C4'}).removeClass('dark');
            $('.wB_card').removeClass('dark');
            $('#wB_info').removeClass('dark');
            $('#bodyOverlay').css('opacity', 0.1);
            $('.wB_cardBtn').removeClass('cardBtnDark');
        }
    }

    getDarkModeSetting() {
        let isDark = localStorage.getItem('isDarkMode');

        if (isDark == 'true') {
            return true;
        } else {
            return false;
        }
    }

    setDarkModeSetting(value) {
        localStorage.setItem('isDarkMode', value);
    }

    /* --------------------- 
       Cards Functions
       --------------------- */

    cardsAddTextArea(element) {
        this.cardChange = element;
        let text = element.find('span').text();
        let dark = this.isDarkMode === true ? 'dark' : '';

        element
            .addClass('wB_card_focus')
            .html('<textarea id="wB_cardTextArea" class="wB_card_text ' + dark + '" maxlength="32"></textarea>');
        
        $('#wB_cardTextArea').focus().val(text);
    }

    cardsSetNewTextToCard(element) {
        let text = element.find('textarea').val();
        return this.cardsValidateCard(element, text);
    }

    cardsRevertCard(element) {
        let text = this.cards[element.attr('data-id')].text;
        return this.cardsValidateCard(element, text);
    }

    cardsValidateCard(element, text) {
        text = text.trim();
        const card = this.getThisPlayer().cardMap.get(parseInt(element.attr('data-id')));
        
        // Check if no change
        if ((card.word == null && text === '') || (card.word != null && card.word.text === text)) {
            this.cardsSetTextHTML(this.cardChange, text);
            return true;
        }

        // Check if valid
        if (this.cardsDoesTextExist(text) === false) {
            this.socket.emit('setCard', {
                cardId: element.attr('data-id'),
                cardText: text
            });
            return true;
        } else {
            this.shakeAndStay(element);
            return false;
        }
    }

    // Should only triggered after server validation
    cardsSetCard(card) {
        this.getThisPlayer().cardMap.set(card.id, card);
        this.cardsSetTextHTML(this.selectedCardsGrid.find('[data-id=' + card.id + ']'), card.word != null ? card.word.text : '');
    }

    cardsSetTextHTML(element, text) {
        element.removeClass('wB_card_focus');
        element.html('<span class="wB_card_text"></span>');
        element.find('.wB_card_text').text(text);
        
        this.cardChange = null;
        this.cardsCheckAllFilled();
        this.cardsFocusNext();
    }

    cardsFocusNext() {
        if (this.nextFocusCardId != null) {
            this.cardsAddTextArea(this.selectedCardsGrid.find('[data-id=' + + this.nextFocusCardId + ']'));
            this.nextFocusCardId = null;
        }
    }

    cardsDoesTextExist(text) {
        if (text == null || text === '') {
            return false;
        }

        for (let card of this.room.playerMap.get(this.socket.id).cardMap.values()) {
            if (card.word != null && card.word.text === text) {
                return true;
            }
        }
        return false;
    }

    cardsCheckAllFilled() {
        let areAllCardsFilled = true;
        const cardMap = this.room.playerMap.get(this.socket.id).cardMap;

        for(let card of cardMap.values()) { 
            if (card.word == null || card.word.text === '') {
                this.revertReady();
                areAllCardsFilled = false;
                break;
            }
        }

        this.readyBtnVisible(areAllCardsFilled);
    }

    cardsGetTextArr() {
        let words = [];
        for (let i = 0; i < this.cards.length; i++) {
            if(this.cards[i] != null && this.cards[i].text != '') {
                words.push(this.cards[i].text);
            }
        }
        return words;
    }

    revertReady() {
        if (this.isReady === true) {
            this.socket.emit('toggleReady');
            $('wB_thisUserReady').hide();
        }
        this.isReady = false;
    }

    shakeAndStay(element) {
        element.find('textarea').focus();
        element
            .removeClass('wB_card_focus')
            .addClass('shake_short');

        setTimeout(function() {
            element
                .removeClass('shake_short')
                .addClass('wB_card_focus');
        }, 820);
    }

    cardsAutofill(changedCardMap) {
        const cardMap = this.room.playerMap.get(this.socket.id).cardMap;
        let time = 0;
        for (const cardItem of changedCardMap.values()) {
            cardMap.set(cardItem.id, cardItem);
            const cardEl = this.selectedCardsGrid.find('[data-id=' + cardItem.id + ']');
            this.cardsSetTextHTML(cardEl, cardItem.word.text);

            // Animation
            const cardSpan = cardEl.find('span');
            cardSpan.hide();
            setTimeout(function () { cardSpan.fadeIn(800) }, time);
            time += 50;
        }
    }

    cardsShowField(player) {
        const cards = player.cardMap;
    }

    // Rückwerts effekte kurz erklährung, lel
    cardsFlipAnimation() {
        return new Promise((resolve) => {
            const bigText = $('#wB_bigText').text('Bingo').addClass('fadeLeftToRight').show();
            const cardsText = $('.wB_card_text').addClass('mirror');
            const cardsContainer = $('#wB_cardsContainer').addClass('flip');

            setTimeout(function() {
                bigText.hide().removeClass('fadeLeftToRight');
                cardsText.removeClass('mirror');
                cardsContainer.removeClass('flip');
                resolve();
            }, 2500);
        });
    }

    cardsAddConfirmBox(cardEl) {
        const _self = this;
        const dark = _self.isDarkMode === true ? ' cardBtnDark' : '';

        cardEl.find('.wB_card_text').css({'margin': '0 auto'});
        cardEl.append('<div class="wB_cardConfirmBox"><button id="wB_cardSubmit" class="wB_cardBtn' + dark + '"><i class="mi">done</i>' + 
            '</button><button id="wB_cardCancel" class="wB_cardBtn' + dark + '"><i class="mi">close</i></button></div>')
            .addClass('wB_card_focus');

        $('#wB_cardSubmit').on('click', function() {
            _self.socket.emit('cardWordSaid', _self.cardChange.attr('data-id'));
        });
        $('#wB_cardCancel').on('click', function() {
            _self.cardsRemoveConfirmBox(_self.cardChange);
        });
        this.cardChange = cardEl;
    }

    cardsRemoveConfirmBox(cardEl) {
        cardEl.find('.wB_card_text').attr('style', '');
        cardEl.removeClass('wB_card_focus').find('.wB_cardConfirmBox').remove();
        this.cardChange = null;
    }

    /* --------------------- 
       Room Functions
       --------------------- */

    roomAddPlayer(playerMap) {
        const _self = this;
        playerMap.forEach(function(player) {
            _self.roomAddPlayerHTML(player);
        });
    }
    
    roomAddPlayerHTML(player) {
        const _self = this;
        const isReadyStyle = player.isReady === true ? 'style="display: block;"' : '';

        if (player.id === _self.socket.id) { 
            $('#wB_lobbyContainer')
                .append('<div id="wB_thisUserField" class="wB_userField wb_userSelected" data-id="' + player.id + '"><img id="wB_thisUserPic" src="' + player.avatar.picUrl + '" class="wB_userPic" alt="Profilbild" />' + 
                '<input id="wB_thisUserInput" class="wB_userName" type="text" value="' + player.avatar.name + '"><button id="wB_thisUserReady" class="btn wB_userReady">' + 
                '<i class="mi">done</i></button><div class="wB_userFieldPointer"></div></div>');
            
            $('#wB_thisUserInput').change(function() {
                _self.socket.emit('changeName', $(this).val()); 
            });
    
            $('#wB_thisUserReady').click(function() {
                _self.socket.emit('toggleReady'); 
            });
        } else {
            $('#wB_lobbyContainer')
                .append('<div class="wB_userField" data-id="' + player.id + '"><i class="mi wB_userReady" ' + isReadyStyle + '>done</i>' + 
                '<img src="' + player.avatar.picUrl + '" class="wB_userPic" alt="Profilbild" />' + 
                '<div class="wB_userName">' + player.avatar.name + '</div><div class="wB_userFieldPointer"></div></div>');
        }
    }

    roomRemovePlayerHTML(playerId) {
        $('.wB_userField[data-id=' + playerId + ']').remove();
    }

    roomPlayerChangeName(playerId, name) {
        $('.wB_userField[data-id=' + playerId + ']').find('.wB_userName').text(name);
    }

    roomSetPlayerReadyHTML(playerId, isReady) {
        console.log('roomSetPlayerReadyHTML', playerId, isReady);
        if (playerId === this.socket.id) {
            if (isReady === true) {
                $('#wB_thisUserReady').css({'color': 'green'});
            } else {
                $('#wB_thisUserReady').css({'color': 'gray'});
            }
        } else {
            let player = $('.wB_userField[data-id=' + playerId + ']');
            if (player != null) {
                if (isReady === true) {
                    player.find('.wB_userReady').show();
                } else {
                    player.find('.wB_userReady').hide();
                }
            }
        }
    }

    roomStartCountdown(timeMS) {
        $('#wB_countdownContainer').fadeIn(300);
        const counterEl = $('#wB_countdownCounter');

        this.countdownId = null;
        
        const countDown = (timeMS) => {
            counterEl.text(Math.floor(timeMS / 1000));
            this.countdownId = setTimeout(() => {
                counterEl.text(Math.floor(timeMS / 1000));

                if (timeMS > 0) {
                    timeMS = timeMS - 1000;
                    countDown(timeMS);
                }
            }, 1000);
        }

        countDown(timeMS);
    }

    roomStopCountdown() {
        clearTimeout(this.countdownId);
        $('#wB_countdownContainer').fadeOut(800);
    }

    roomUnreadyPlayer(playerMap) {
        for (const player of playerMap.values()) {
            console.log('roomUnreadyPlayer', player);
            if (player.isReady === true) {
                this.roomSetPlayerReadyHTML(player, false);
            }
            player.isReady = false;
        }
    }

    roomStartBingoPhase(room) {
        const _self = this;
        _self.cardsFlipAnimation().then(function() {
            _self.addEventsBingoPhase();
        });
        _self.cardChange = null;
        _self.room = new Room(room);
        
        $('#wB_countdownContainer').fadeOut(800);
        $('.wB_userReady').hide();
    }

    /* --------------------- 
       Other Functions
       --------------------- */

    toggleInfo() {
        this.isInfoOpen = !this.isInfoOpen;
        $('#wB_info').fadeToggle(400);
    }

    getUrlParam(param)
    {
       let query = window.location.search.substring(1);
       let vars = query.split("&");
       for (let i=0;i<vars.length;i++) {
               let pair = vars[i].split("=");
               if(pair[0] == param) {
                   return pair[1];
                }
       }
       return null;
    }

    readyBtnVisible(isVisible) {
        if (isVisible === true) {
            $('#wB_thisUserReady').show();
        } else {
            $('#wB_thisUserReady').hide();
        }
    }

    arrToCardMap(cardArr) {
        const cardMap = new Map();
        for (let i = 0; i < cardArr.length; i++) {
            cardMap.set(cardArr[i][0], new Card(cardArr[i][1]));
        }
        return cardMap;
    }

    getThisPlayer() {
        return this.room.playerMap.get(this.socket.id);
    }

    showErrorToast(errorStr) {
        $('#wB_errorToast').finish().text(errorStr).fadeIn(300).delay(4000).fadeOut(800);
    }

    makeScrollableX() {
        const _self = this, elements = $('.wB_scrollX');

        if (elements.length > 0) {
            elements.forEach(function(el) {
                el.append('<div class="wB_scrollbar"></div>');
            });

            $(window).resize(function() {

            });
        }
    }

    sizeScrollbarsX(elements) {
        elements.forEach(function(el) { 
            el.prop('scrollWidth')
        });
    }
}

$(document).ready(function() {
    winklerBingo = new WinklerBingo();
    $('body').fadeIn(1600);
});