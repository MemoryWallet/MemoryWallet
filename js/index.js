(function(global) {
  "use strict";

  let xmr_failure = "XMR Derivation Failure, try again";
  let alc_xmrpublickey = xmr_failure;
  let alc_xmrprivatekey = xmr_failure;
  let alc_xmrprivateview = xmr_failure;
  let alc_xmrpublicview = xmr_failure;
  let alc_xmrpublicspend = xmr_failure;
  let alc_shownXMR = false;
  let phraseM = xmr_failure;
  let set_phraseM = false;
  let hadEntropy = false; // MW 240904
  let Calculating = 0; // MW 240904
  
  let GLOBAL_SHARE_COUNTER = 0;
  //MW 250125 WAS const SUPPORTED_ALT_COINS = ['litecoin', 'ethereum', 'segwit', 'oxen', 'monero', 'solana'];
  const SUPPORTED_ALT_COINS = ['monero'];//MW 250125
  const chrome = navigator.userAgent.toLowerCase().indexOf('webkit') > -1;
  if (!chrome) {
    $('#login-box input').each(function () {
      $(this).attr('disabled', 'disabled');
    });
    $('#result').remove();
    alert(navigator.userAgent);
    alert('This wallet ONLY works on WebKit Browsers');
  }

  const ELEMENT_VARS = {
    runWrapper: '.x-login',
    username: '#xprime',
    password: '#salt',
    btcPub: '#btcpub',
    btcPri: '#btcpri',
    nxtPub: '#nxtacct',
    nxtPri: '#nxtpri'
  };

  const createdDate = new Date().toJSON().slice(0, 10);

  showEncryption('default');
  parseUrlParams();

  uploadImage();

  secretJS();

  function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const user = urlParams.get('user');
    const pass = urlParams.get('pass');
    const displayWallets = urlParams.get('only');
    const autostart = urlParams.get('autostart');

    if(user) {
      $(ELEMENT_VARS.username).val(user);
      updateButton();
    }

    if(pass) {
      $(ELEMENT_VARS.password).val(pass);
    }

    if(displayWallets) { 
      const wallets = displayWallets.split(',');
      $('.currency').hide();
      for(let wallet of wallets) {
        $(`.currency.${wallet}`).show();
      }
    }

    if(user && autostart && autostart == 1) { 
      setTimeout(() => {
        $('#btn').click();
      }, 10);
    }
  }

  function secretJS() {
    $('.secret-share-btn').on('click', function (event) {
      event.preventDefault();
      $(this).next().toggle();
    });

    $('.secret-share-form .split').on('click', function (event) {
      event.preventDefault();
      $('#threshold-error').remove();
      const _this = $(this),
        _form = _this.parent(),
        _wallet = _this.parent().parent(),
        _enableShareBtn = _this.parent().parent().find('.secret-share-btn'),
        privateKey = _wallet.find('.pri-text').text(),
        shareValue = _form.find('.shares').val() * 1,
        thresholdValue = _form.find('.threshold').val() * 1;

      if (privateKey.length > 105) {
        console.log(privateKey.length);
        alert('Password is too long! Secret Sharing Not Compatible. Must be less than 50 characters.');
        return;
      }
      // Doesn't make sense to have threshold > shares
      if (thresholdValue > shareValue) return _this.after('<div id="threshold-error" style="color: red;">Threshold can\'t be bigger than shares.</div>');

      if (privateKey && shareValue && thresholdValue) {
        if (!secrets && typeof secrets != 'object') return; //Make sure secret library is included
        const shares = secrets.share(secrets.str2hex(privateKey), shareValue, thresholdValue);
        for (let i = 0; i < shareValue; i++) {
          let label = i + 1,
            clonedWallet = _wallet.clone().addClass(`cloned`);

          cloneWallet(_wallet, clonedWallet, label, shareValue, shares[i]);
        }
        //remove the form, we don't want users to make multiple splits on one coin.
        _form.remove();
        _enableShareBtn.remove();
      }
    });
  }//func secretJS

  function cloneWallet(originalWallet, clonedWallet, label, maxShare, share) {
    const wallet = clonedWallet,
      priKeySelector = $('.pri-text', wallet).attr('id'),
      qrSelector = $('.qr-image.qr-pri', wallet).attr('id'),
      newPriKeySelector = `${priKeySelector}-shares-${label}`,
      newqrSelector = `${qrSelector}-shares-${label}`;

    $('.secret-share-form, .secret-share-btn', wallet).remove();
    $(`#${qrSelector}`, wallet).html('');
    $(`#${priKeySelector}`, wallet).attr('id', newPriKeySelector);
    $(`#${qrSelector}`, wallet).attr('id', newqrSelector);
    $('.upload', wallet).after(`<span class="share-counter">${label}/${maxShare}</span>`);
    originalWallet.after(wallet);


    $(`#${newPriKeySelector}`).text(share);
    makeQRImage(newqrSelector, share, 400, 400);
  }

  $('#btn').click(function (event) {
    event.preventDefault();
    $('.tos-container').show();
    $('body').addClass('tos-show');
  });

  $('.tos-footer button').click(function (event) {
    event.stopPropagation();
    $('.tos-container').hide();
    $('body').removeClass('tos-show');
    generateCoins(''/* No entropy */);
  });

  function setMnemonicFromEntropy(entropyStr) {
	  console.log('setMnemonicFromEntropy ALC has str',entropyStr);// MW 240904
      var mnemonics = { "english": new Mnemonic("english") };
      var mnemonic = mnemonics["english"];
      // Get entropy value
      var entropy = null;
      entropy = Entropy.fromString(entropyStr);
      if (entropy.binaryStr.length == 0) {
          return 'failure';
      }
      // Show entropy details
      // Use entropy hash if not using raw entropy
      var bits = entropy.binaryStr;
      var mnemonicLength = "raw"; // hardcoding, was DOM.entropyMnemonicLength.val();
      if (mnemonicLength != "raw") {
          // Get bits by hashing entropy with SHA256
          var hash = sjcl.hash.sha256.hash(entropy.cleanStr);
          var hex = sjcl.codec.hex.fromBits(hash);
          bits = libs.BigInteger.BigInteger.parse(hex, 16).toString(2);
          while (bits.length % 256 != 0) {
              bits = "0" + bits;
          }
          // Truncate hash to suit number of words
          mnemonicLength = parseInt(mnemonicLength);
          var numberOfBits = 32 * mnemonicLength / 3;
          bits = bits.substring(0, numberOfBits);
          // show warning for weak entropy override
          if (mnemonicLength / 3 * 32 > entropy.binaryStr.length) {
              DOM.entropyWeakEntropyOverrideWarning.removeClass("hidden");
          }
          else {
              DOM.entropyWeakEntropyOverrideWarning.addClass("hidden");
          }
      }
      else {
          DOM.entropyWeakEntropyOverrideWarning.addClass("hidden");
      }
      // Discard trailing entropy
      var bitsToUse = Math.floor(bits.length / 32) * 32;
      var start = bits.length - bitsToUse;
      var binaryStr = bits.substring(start);
      // Convert entropy string to numeric array
      var entropyArr = [];
      for (var i=0; i<binaryStr.length / 8; i++) {
          var byteAsBits = binaryStr.substring(i*8, i*8+8);
          var entropyByte = parseInt(byteAsBits, 2);
          entropyArr.push(entropyByte)
      }
      // Convert entropy array to mnemonic
      var phrase = mnemonic.toMnemonic(entropyArr);

	  return phrase;
  }

  function generateCoins(entropy) {
	console.log('generateCoins',entropy); // MW 241209
    let power = $('input[name="power-level"]:checked').val();;
    setResult('.date', 'Created ' + createdDate);
    const params = {
      power: power,
      currency: 'bitcoin',
      privateKey: null,
      altCoin: false,
	  entropy: entropy
    };

    generate(params, result => {
	  setResult('#entropy', result.key);
	  var x = '';

      drawIdenticon(`.i-btc`, result.public);
      makeQRImage(`qr-btcpub`, result.public);
      makeQRImage(`qr-btcpri`, result.private);

      const addedSalt = $('#salt').val();
      const publicKey = createNXT(addedSalt + result.private).publicKey;
      let address = createNXT(addedSalt + result.private).accountID;
      address = address.replace('NXT', 'ARDOR');

      const passphrase = addedSalt + result.private;
      $(ELEMENT_VARS.nxtPub).html(address);
      $(ELEMENT_VARS.nxtPri).html(passphrase);
      drawIdenticon(`.i-nxt`, address);
      makeQRImage(`qr-nxtacct`, address);
      makeQRImage(`qr-nxtpri`, passphrase);
      x = generateAltCoins(result.private, power, params.entropy);
      //MW 250125 not used generateEOS(result.private);
	  console.log('hidePending 1 generate'); // ALC
	  hidePending(); // MW 240904
    });
  }

  function generateAltCoins(privateKey, power, entropy) {
    let xmrpublickey = 'malarkey';
    const params = {
      power: power,
      currency: null,
      privateKey: privateKey,
      altCoin: true,
	  entropy: entropy
    };
    for (let altcoin of SUPPORTED_ALT_COINS) {
      let alt = altCoinCode(altcoin);
      params.currency = altcoin;
      $('#progress center').text('Generating alt coins...');
      generate(params, result => {
        validateKeys(alt, result) 

        drawIdenticon(`.i-${alt}`, result.public);

        if (alt == 'oxen' || alt == 'xmr') {
		  if (alt == 'xmr') {
		    xmrpublickey = result.public;
		    alc_xmrpublickey = result.public;
		    alc_xmrprivatekey = result.private_spend;
		    alc_xmrprivateview = result.private_view;
		    alc_xmrpublicview = result.public_view;
		    alc_xmrpublicspend = result.public_spend;
		  }

          setResult(`#${alt}pri-spend`, result.private_spend);
          setResult(`#${alt}pri-view`, '<strong><sup>VIEW</sup></strong>' + result.private_view);

          makeQRImage(`qr-${alt}pub`, result.public);
          // makeQRImage(`qr-xmrpub-spend`, result.public_spend);
          makeQRImage(`qr-${alt}pri-spend`, result.private_spend);
          // makeQRImage(`qr-xmrpub-view`, result.public_view);
          makeQRImage(`qr-${alt}pri-view`, result.private_view);
        } else {
          setResult(`#${alt}pub`, result.public);
          setResult(`#${alt}pri`, result.private);
          makeQRImage(`qr-${alt}pub`, result.public);
          makeQRImage(`qr-${alt}pri`, result.private);
        }
      });
    }
    $('#result').toggle();
	console.log('NO login-box toggle 1');// MW 241209
    //$('#login-box').toggle();// MW 241209
    $('.result-btn').toggle();
	return xmrpublickey;
  }

  function generateEOS(btcpri) {
    const privateKey = eosjs_ecc.seedPrivate(btcpri);
    const publicKey = eosjs_ecc.privateToPublic(privateKey);

    validateKeys('eos', {public: publicKey, private: privateKey});

    setResult(`#eospub`, publicKey);
    setResult(`#eospri`, privateKey);
    makeQRImage(`qr-eospub`, publicKey);
    makeQRImage(`qr-eospri`, privateKey);
    drawIdenticon(`.i-eos`, publicKey);
  }

  (function rerun() {
    $('.rerun-btn').on('click', function () {
      const answer = confirm("Make sure to save your current wallet.");
      if (answer) {
        $('.result-btn').toggle();
        $('#result').toggle();
		console.log('login-box toggle 2');// MW 241209
        $('#login-box').toggle();
        $('#login-box .form-control').val('');
        $('#login-box fieldset').attr('disabled', false);
        $('#btn').show();
        $('.qr-image').html('');
        $('.identicon').html('');
        $('.cloned').remove();
      }
    });
  })();

  (function print() {
    $('.print').on('click', function () {
      global.print();
    });
  })();

  (function encryptionStatus() {
    $('#lvl-wrap .power-level').on('click', function () {
      const power = $('input[name="power-level"]:checked').val();
      showEncryption(power);
    });
  })();

  function showEncryption(power) {
    let spow, spow2, pText, sText, pPower, sPower;
    sPower = power;
    pPower = 16;

    if (sPower == 'default') {
      spow = 262144;
      spow2 = 65000;
      pText = sText = 'default';
    } else if (sPower == 'Offline Hardened') {
      spow = 2097152;
      spow2 = 256000;
      pText = sText = 'Offline Hardened';
    } else {
      spow = Math.pow(2, parseInt(sPower));
      spow2 = Math.pow(2, pPower);
      pText = pPower;
      sText = sPower;
    }

    //Detect custom hash for setting power levels
    var urlhash = new RegExp('[\?&]lvl=([^&#]*)').exec(global.location.href);
    if ((urlhash != null)) {
      let lvl = decodeURI(urlhash[1]) || 0;
      sText = pText = 'custom';
      sPower = lvl.substring(0, 2);
      spow = Math.pow(2, sPower);
      spow2 = parseInt(lvl.substring(2, 9)) || 65536;
    }

    $('#lvl-scrypt').text(`scrypt: ${sText} =  ${spow}`);
    $('#lvl-pbkdf2').text(`pbkdf2: ${pText} = ${spow2}`);
  }

  function setResult(selector, value) {
    try { 
      $(`${selector}`).html(value);
    } catch (e) { 
      console.error(e.message)
    }
  }

  function createNXT(value) {
    const nxtPairs = {};
    nxtPairs.accountID = nxtjs.secretPhraseToAccountId(value);
    nxtPairs.publicKey = nxtjs.secretPhraseToPublicKey(value);
    return nxtPairs;
  }

  function validateKeys(coin, addresses) { 
    console.log('validateKeys ALC', coin);
    const coinKeys = getDefinedKeyLength(coin);

    if(Object.prototype.toString.apply(coinKeys) !== "[object Object]") return; 

    for(let i = 0; i < Object.keys(coinKeys).length; i++) {
      const key = Object.keys(coinKeys)[i];
      if((coinKeys[key] !== addresses[key].length) && (coin != 'sol') && (coin != 'xmr')) { //MW230623  xmr reducedMnemonic has various lengths
        alert(`Please choose another username and password combination. Error: ${coin.toUpperCase()}`);
        window.location.reload(); 
        break;
      }
	 if(coin == 'xmr') { //MW230626 
		 phraseM = addresses.reducedMnemonic;//MW230626
         // MW 241209 if (!set_phraseM && $('#xprime').val() == '') {
		   DOM.phraseM.val(phraseM);
           set_phraseM = true;
		   console.log('Have set phraseM, calling entropyChanged'); // MW 241209
		   entropyChanged(); // MW 241209
		 //}		   
	 }
    }
  }

  function getDefinedKeyLength(coin) {
    const keysObj = {
      eth: {
        public: 42,
        private: 64,
      },
      xmr: {
        public: 95,
        private_view: 64,
        private_spend: 64,
		reducedMnemonic: 256 //MW230623 try this
      },
      oxen: {
        public: 95,
        private_view: 64,
        private_spend: 64
      },
      sol: {
        public: 44,
        private: 88, //sometimes 87 char
      },
      eos: {
        public: 53, 
        private: 51
      }
    };

    return keysObj[coin] || null;
  }

  function altCoinCode(altcoin) {
    switch (altcoin) {
      case 'litecoin':
        return 'ltc';
      case 'ethereum':
        return 'eth';
      case 'segwit':
        return 'seg';
      case 'monero':
        return 'xmr';
      case 'oxen':
        return 'oxen';
      case 'solana':
        return 'sol';
    }
    return '';
  }

  function makeQRImage(IDSelector, text, width = 209, height = 209) {
    try{
      new QRCode(IDSelector, {
        text: text,
        width: width,
        height: height
      });
    } catch (e) {
      console.error(e.message);
    }
  }

  function drawIdenticon(selector, value, size = 40) {
    try {
      const svg = jdenticon.toSvg(value, size);
      $(selector).append(svg); 
    } catch (error) { 
      console.error(e.message)
    }
  }

  function uploadImage() {
    $(document).on('click', '.upload', function () {
      const $bgImage = $(this).parent().find('.wallet-bg');
      const $uploadInput = $(this).find('input[type="file"]');
      $uploadInput.change(function (e) {
        const reader = new FileReader();
        reader.onload = function () {
          $bgImage.attr('src', reader.result);
        };
        reader.readAsDataURL(e.target.files[0]);
      });
    });
  }

  $("#expert").click(function () {
    $("#levels").toggle();
  });

  $(".upload button").click(function () {
    $(this).parent().parent().fadeOut(888);
  });

    // mnemonics is populated as required by getLanguage
    var mnemonics = { "english": new Mnemonic("english") };
    var mnemonic = mnemonics["english"];
    var seed = null;
    var bip32RootKey = null;
    var bip32RootKeyClone = null;
    var bip32ExtendedKey = null;
    var network = libs.bitcoin.networks.bitcoin;
    var addressRowTemplate = $("#address-row-template");

    var showIndex = true;
    var showAddress = true;
    var showPubKey = true;
    var showPrivKey = true;
    var showQr = false;
    var litecoinUseLtub = true;

    var entropyTypeAutoDetect = true;
    var entropyChangeTimeoutEvent = null;
    var phraseChangeTimeoutEvent = null;
    var seedChangedTimeoutEvent = null;
    var rootKeyChangedTimeoutEvent = null;

    var generationProcesses = [];

    var DOM = {};
    DOM.privacyScreenToggle = $(".privacy-screen-toggle");
    DOM.network = $(".network");
    DOM.bip32Client = $("#bip32-client");
    DOM.phraseNetwork = $("#network-phrase");
    DOM.useEntropy = $(".use-entropy");
    DOM.entropyContainer = $(".entropy-container");
    DOM.entropy = $(".entropy");
	DOM.xmrpublic = DOM.entropyContainer.find(".xmrpublic");
	DOM.xmrprivate = DOM.entropyContainer.find(".xmrprivate");
	DOM.xmrprivateview = DOM.entropyContainer.find(".xmrprivateview");
	DOM.xmrpublicview = DOM.entropyContainer.find(".xmrpublicview");
    DOM.entropyFiltered = DOM.entropyContainer.find(".filtered");
    DOM.entropyType = DOM.entropyContainer.find(".type");
    DOM.entropyTypeInputs = DOM.entropyContainer.find("input[name='entropy-type']");
    DOM.entropyCrackTime = DOM.entropyContainer.find(".crack-time");
    DOM.entropyEventCount = DOM.entropyContainer.find(".event-count");
    DOM.entropyBits = DOM.entropyContainer.find(".bits");
    DOM.entropyBitsPerEvent = DOM.entropyContainer.find(".bits-per-event");
    DOM.entropyWordCount = DOM.entropyContainer.find(".word-count");
    DOM.entropyBinary = DOM.entropyContainer.find(".binary");
    DOM.entropyWordIndexes = DOM.entropyContainer.find(".word-indexes");
    DOM.entropyChecksum = DOM.entropyContainer.find(".checksum");
    DOM.entropyMnemonicLength = DOM.entropyContainer.find(".mnemonic-length");
    DOM.pbkdf2Rounds = DOM.entropyContainer.find(".pbkdf2-rounds");
    DOM.pbkdf2CustomInput = DOM.entropyContainer.find("#pbkdf2-custom-input");
    DOM.pbkdf2InfosDanger = $(".PBKDF2-infos-danger");
    DOM.entropyWeakEntropyOverrideWarning = DOM.entropyContainer.find(".weak-entropy-override-warning");
    DOM.entropyFilterWarning = DOM.entropyContainer.find(".filter-warning");
    DOM.phrase = $(".phrase");
	DOM.phraseM = $(".phraseM"); /* MW 230620  */ 
    DOM.autoCompute = $(".autoCompute");
    DOM.splitMnemonic = $(".splitMnemonic");
    DOM.showSplitMnemonic = $(".showSplitMnemonic");
    DOM.phraseSplit = $(".phraseSplit");
    DOM.phraseSplitWarn = $(".phraseSplitWarn");
    DOM.passphrase = $(".passphrase");
    DOM.generateContainer = $(".generate-container");
    DOM.generate = $(".generate");
    DOM.seed = $(".seed");
    DOM.rootKey = $(".root-key");
    DOM.litecoinLtubContainer = $(".litecoin-ltub-container");
    DOM.litecoinUseLtub = $(".litecoin-use-ltub");
    DOM.extendedPrivKey = $(".extended-priv-key");
    DOM.extendedPubKey = $(".extended-pub-key");
    DOM.bip32tab = $("#bip32-tab");
    DOM.bip44tab = $("#bip44-tab");
    DOM.bip49tab = $("#bip49-tab");
    DOM.bip84tab = $("#bip84-tab");
    DOM.bip141tab = $("#bip141-tab");
    DOM.bip32panel = $("#bip32");
    DOM.bip44panel = $("#bip44");
    DOM.bip49panel = $("#bip49");
    DOM.bip32path = $("#bip32-path");
    DOM.bip44path = $("#bip44-path");
    DOM.bip44purpose = $("#bip44 .purpose");
    DOM.bip44coin = $("#bip44 .coin");
    DOM.bip44account = $("#bip44 .account");
    DOM.bip44accountXprv = $("#bip44 .account-xprv");
    DOM.bip44accountXpub = $("#bip44 .account-xpub");
    DOM.bip44change = $("#bip44 .change");
    DOM.bip49unavailable = $("#bip49 .unavailable");
    DOM.bip49available = $("#bip49 .available");
    DOM.bip49path = $("#bip49-path");
    DOM.bip49purpose = $("#bip49 .purpose");
    DOM.bip49coin = $("#bip49 .coin");
    DOM.bip49account = $("#bip49 .account");
    DOM.bip49accountXprv = $("#bip49 .account-xprv");
    DOM.bip49accountXpub = $("#bip49 .account-xpub");
    DOM.bip49change = $("#bip49 .change");
    DOM.bip84unavailable = $("#bip84 .unavailable");
    DOM.bip84available = $("#bip84 .available");
    DOM.bip84path = $("#bip84-path");
    DOM.bip84purpose = $("#bip84 .purpose");
    DOM.bip84coin = $("#bip84 .coin");
    DOM.bip84account = $("#bip84 .account");
    DOM.bip84accountXprv = $("#bip84 .account-xprv");
    DOM.bip84accountXpub = $("#bip84 .account-xpub");
    DOM.bip84change = $("#bip84 .change");
    DOM.bip85 = $('.bip85');
    DOM.showBip85 = $('.showBip85');
    DOM.bip85Field = $('.bip85Field');
    DOM.bip85application = $('#bip85-application');
    DOM.bip85mnemonicLanguage = $('#bip85-mnemonic-language');
    DOM.bip85mnemonicLanguageInput = $('.bip85-mnemonic-language-input');
    DOM.bip85mnemonicLength = $('#bip85-mnemonic-length');
    DOM.bip85mnemonicLengthInput = $('.bip85-mnemonic-length-input');
    DOM.bip85index = $('#bip85-index');
    DOM.bip85indexInput = $('.bip85-index-input');
    DOM.bip85bytes = $('#bip85-bytes');
    DOM.bip85bytesInput = $('.bip85-bytes-input');
    DOM.bip141unavailable = $("#bip141 .unavailable");
    DOM.bip141available = $("#bip141 .available");
    DOM.bip141path = $("#bip141-path");
    DOM.bip141semantics = $(".bip141-semantics");
    DOM.generatedStrength = $(".generate-container .strength");
    DOM.generatedStrengthWarning = $(".generate-container .warning");
    DOM.hardenedAddresses = $(".hardened-addresses");
    DOM.bitcoinCashAddressTypeContainer = $(".bch-addr-type-container");
    DOM.bitcoinCashAddressType = $("[name=bch-addr-type]")
    DOM.useBip38 = $(".use-bip38");
    DOM.bip38Password = $(".bip38-password");
    DOM.addresses = $(".addresses");
    DOM.csvTab = $("#csv-tab a");
    DOM.csv = $(".csv");
    DOM.rowsToAdd = $(".rows-to-add");
    DOM.more = $(".more");
    DOM.moreRowsStartIndex = $(".more-rows-start-index");
    DOM.feedback = $(".feedback");
    DOM.tab = $(".derivation-type a");
    DOM.indexToggle = $(".index-toggle");
    DOM.addressToggle = $(".address-toggle");
    DOM.publicKeyToggle = $(".public-key-toggle");
    DOM.privateKeyToggle = $(".private-key-toggle");
    DOM.languages = $(".languages a");
    DOM.qrContainer = $(".qr-container");
    DOM.qrHider = DOM.qrContainer.find(".qr-hider");
    DOM.qrImage = DOM.qrContainer.find(".qr-image");
    DOM.qrHint = DOM.qrContainer.find(".qr-hint");
    DOM.showQrEls = $("[data-show-qr]");

    function init() {
        // Events
        DOM.privacyScreenToggle.on("change", privacyScreenToggled);
        DOM.generatedStrength.on("change", generatedStrengthChanged);
        DOM.network.on("change", networkChanged);
        DOM.bip32Client.on("change", bip32ClientChanged);
        DOM.useEntropy.on("change", setEntropyVisibility);
        DOM.autoCompute.on("change", delayedPhraseChanged);
        DOM.entropy.on("input", delayedEntropyChanged);
        DOM.entropyMnemonicLength.on("change", entropyChanged);
        DOM.pbkdf2Rounds.on("change", pbkdf2RoundsChanged);
        DOM.pbkdf2CustomInput.on("change", pbkdf2RoundsChanged);
        DOM.entropyTypeInputs.on("change", entropyTypeChanged);
        DOM.phrase.on("input", delayedPhraseChanged);
        DOM.showSplitMnemonic.on("change", toggleSplitMnemonic);
        DOM.passphrase.on("input", delayedPhraseChanged);
        DOM.generate.on("click", generateClicked);
        DOM.more.on("click", showMore);
        DOM.seed.on("input", delayedSeedChanged);
        DOM.rootKey.on("input", delayedRootKeyChanged);
        DOM.showBip85.on('change', toggleBip85);
        DOM.litecoinUseLtub.on("change", litecoinUseLtubChanged);
        DOM.bip32path.on("input", calcForDerivationPath);
        DOM.bip44account.on("input", calcForDerivationPath);
        DOM.bip44change.on("input", calcForDerivationPath);
        DOM.bip49account.on("input", calcForDerivationPath);
        DOM.bip49change.on("input", calcForDerivationPath);
        DOM.bip84account.on("input", calcForDerivationPath);
        DOM.bip84change.on("input", calcForDerivationPath);
        DOM.bip85application.on('input', calcBip85);
        DOM.bip85mnemonicLanguage.on('change', calcBip85);
        DOM.bip85mnemonicLength.on('change', calcBip85);
        DOM.bip85index.on('input', calcBip85);
        DOM.bip85bytes.on('input', calcBip85);
        DOM.bip141path.on("input", calcForDerivationPath);
        DOM.bip141semantics.on("change", tabChanged);
        DOM.tab.on("shown.bs.tab", tabChanged);
        DOM.hardenedAddresses.on("change", calcForDerivationPath);
        DOM.useBip38.on("change", calcForDerivationPath);
        DOM.bip38Password.on("change", calcForDerivationPath);
        DOM.indexToggle.on("click", toggleIndexes);
        DOM.addressToggle.on("click", toggleAddresses);
        DOM.publicKeyToggle.on("click", togglePublicKeys);
        DOM.privateKeyToggle.on("click", togglePrivateKeys);
        DOM.csvTab.on("click", updateCsv);
        DOM.languages.on("click", languageChanged);
        DOM.bitcoinCashAddressType.on("change", bitcoinCashAddressTypeChange);
        setQrEvents(DOM.showQrEls);
        disableForms();
        hidePending();
        hideValidationError();
        populateNetworkSelect();
        populateClientSelect();
    }

    // Event handlers

    function generatedStrengthChanged() {
        var strength = parseInt(DOM.generatedStrength.val());
        if (strength < 12) {
            DOM.generatedStrengthWarning.removeClass("hidden");
        }
        else {
            DOM.generatedStrengthWarning.addClass("hidden");
        }
    }

    function networkChanged(e) {
        clearDerivedKeys();
        clearAddressesList();
        DOM.litecoinLtubContainer.addClass("hidden");
        DOM.bitcoinCashAddressTypeContainer.addClass("hidden");
        var networkIndex = e.target.value;
        var network = networks[networkIndex];
        network.onSelect();
        adjustNetworkForSegwit();
        if (seed != null) {
            seedChanged()
        }
        else {
            rootKeyChanged();
        }
    }

    function bip32ClientChanged(e) {
        var clientIndex = DOM.bip32Client.val();
        if (clientIndex == "custom") {
            DOM.bip32path.prop("readonly", false);
        }
        else {
            DOM.bip32path.prop("readonly", true);
            clients[clientIndex].onSelect();
            rootKeyChanged();
        }
    }

    function isUsingAutoCompute() {
        return DOM.autoCompute.prop("checked");
    }

    function setEntropyVisibility() {
        if (isUsingOwnEntropy()) {
            DOM.entropyContainer.removeClass("hidden");
            DOM.generateContainer.addClass("hidden");
            /*DOM.phrase.prop("readonly", true);*/
            DOM.entropy.focus();
			console.log('call 1 entropyChanged');// MW 241209
            entropyChanged();
        }
        else {
            DOM.entropyContainer.addClass("hidden");
            DOM.generateContainer.removeClass("hidden");
            DOM.phrase.prop("readonly", false);
			console.log('hidePending 2 setEntropyVisibility'); // MW 241209
            hidePending();
        }
    }

    function delayedPhraseChanged() {
	console.log('delayedPhraseChanged, Calculating =',Calculating); // MW 241209
	/**/
	if (Calculating > 2) { // MW 241209
		set_phraseM = false;
		phraseM = xmr_failure;
		alc_xmrpublickey = xmr_failure;
		DOM.phraseM.val('');
		Calculating = 0;
	}
	/**/
    if (alc_xmrpublickey == xmr_failure) {
		// Here the entropy is passed in from the mnemonic (and salt, if used originally) being entered on webpage
		var theEntropy = mnemonic.toRawEntropyHex(DOM.phrase.val());
		hadEntropy = true; // MW 240904
		generateCoins(theEntropy);
	}
	/**/

    if(isUsingAutoCompute()) {
        hideValidationError();
        seed = null;
        bip32RootKey = null;
        bip32ExtendedKey = null;
        clearAddressesList();
		console.log('showPending 1 delayedPhraseChanged'); // MW 241209
        showPending();
        if (phraseChangeTimeoutEvent != null) {
            clearTimeout(phraseChangeTimeoutEvent);
        }
        phraseChangeTimeoutEvent = setTimeout(function() {
            phraseChanged();
            var entropy = mnemonic.toRawEntropyHex(DOM.phrase.val());
            if (entropy !== null) {
                DOM.entropyMnemonicLength.val("raw");
                DOM.entropy.val(entropy);
                DOM.entropyTypeInputs.filter("[value='hexadecimal']").prop("checked", true);
                entropyTypeAutoDetect = false;
            }
        }, 400);
    } else {
        clearDisplay();
        clearEntropyFeedback();
        showValidationError("Auto compute is disabled");
    }
    }

    function phraseChanged() {
		console.log('showPending 2 phraseChanged'); // MW 241209
        showPending();
        setMnemonicLanguage();
        // Get the mnemonic phrase
        var phrase = DOM.phrase.val();
        var errorText = findPhraseErrors(phrase);
        if (errorText) {
            showValidationError(errorText);
            return;
        }
        // Calculate and display
        var passphrase = DOM.passphrase.val();
        calcBip32RootKeyFromSeed(phrase, passphrase);
        calcForDerivationPath();
        calcBip85();
        // Show the word indexes
        showWordIndexes();
        writeSplitPhrase(phrase);
    }

    function tabChanged() {
		console.log('showPending 3 tabChanged'); // ALC
        showPending();
        adjustNetworkForSegwit();
        var phrase = DOM.phrase.val();
        var seed = DOM.seed.val();
        if (phrase != "") {
            // Calculate and display for mnemonic
            var errorText = findPhraseErrors(phrase);
            if (errorText) {
                showValidationError(errorText);
                return;
            }
            // Calculate and display
            var passphrase = DOM.passphrase.val();
            calcBip32RootKeyFromSeed(phrase, passphrase);
        }
        else if (seed != "") {
          bip32RootKey = libs.bitcoin.HDNode.fromSeedHex(seed, network);
          var rootKeyBase58 = bip32RootKey.toBase58();
          DOM.rootKey.val(rootKeyBase58);
        }
        else {
            // Calculate and display for root key
            var rootKeyBase58 = DOM.rootKey.val();
            var errorText = validateRootKey(rootKeyBase58);
            if (errorText) {
                showValidationError(errorText);
                return;
            }
            // Calculate and display
            calcBip32RootKeyFromBase58(rootKeyBase58);
        }
        calcForDerivationPath();
    }

    function delayedEntropyChanged() {
        hideValidationError();
		console.log('showPending 4 delayedEntropyChanged'); // MW 241209
        showPending();
        if (entropyChangeTimeoutEvent != null) {
            clearTimeout(entropyChangeTimeoutEvent);
        }
        entropyChangeTimeoutEvent = setTimeout(entropyChanged, 400);
    }

    function pbkdf2RoundsChanged() {
        if (DOM.pbkdf2Rounds.val() == "custom") {
            PBKDF2_ROUNDS = DOM.pbkdf2CustomInput.val();
            DOM.pbkdf2CustomInput.removeClass("hidden");
        } else {
            PBKDF2_ROUNDS = DOM.pbkdf2Rounds.val();
            DOM.pbkdf2CustomInput.addClass("hidden");
        }
        ispbkdf2Rounds2048();
        phraseChanged();
    }
    function ispbkdf2Rounds2048() {
        if (PBKDF2_ROUNDS == 2048) {
            DOM.pbkdf2InfosDanger.addClass("hidden");
        } else {
            DOM.pbkdf2InfosDanger.removeClass("hidden");
        }
    }
    function entropyChanged() {
		console.log('entropyChanged'); // MW 241209
        // If blank entropy, clear mnemonic, addresses, errors
        if (DOM.entropy.val().trim().length == 0) {
            clearDisplay();
            clearEntropyFeedback();
            DOM.phrase.val("");
            DOM.phraseSplit.val("");
            showValidationError("Blank entropy");
            return;
        }
        // Get the current phrase to detect changes
        var phrase = DOM.phrase.val();
        // Set the phrase from the entropy
        setMnemonicFromEntropy();
        // Recalc addresses if the phrase has changed
        var newPhrase = DOM.phrase.val();
        if (newPhrase != phrase) {
            if (newPhrase.length == 0) {
                clearDisplay();
            }
            else {
                phraseChanged();
            }
        }
        else {
			console.log('hidePending 3 entropyChanged'); // MW 241209
            hidePending();
        }
    }

    function entropyTypeChanged() {
        entropyTypeAutoDetect = false;
		console.log('call 2 entropyChanged'); // MW 241209
        entropyChanged();
    }

    function delayedSeedChanged() {
        // Warn if there is an existing mnemonic or passphrase.
        if (DOM.phrase.val().length > 0 || DOM.passphrase.val().length > 0) {
            if (!confirm("This will clear existing mnemonic and passphrase")) {
                DOM.seed.val(seed);
                return
            }
        }
        hideValidationError();
		console.log('showPending 5 delayedSeedChanged'); // MW 241209
        showPending();
        // Clear existing mnemonic and passphrase
        DOM.phrase.val("");
        DOM.phraseSplit.val("");
        DOM.passphrase.val("");
        DOM.rootKey.val("");
        clearAddressesList();
        clearDerivedKeys();
        seed = null;
        if (seedChangedTimeoutEvent != null) {
            clearTimeout(seedChangedTimeoutEvent);
        }
        seedChangedTimeoutEvent = setTimeout(seedChanged, 400);
    }

    function delayedRootKeyChanged() {
        // Warn if there is an existing mnemonic or passphrase.
        if (DOM.phrase.val().length > 0 || DOM.passphrase.val().length > 0) {
            if (!confirm("This will clear existing mnemonic and passphrase")) {
                DOM.rootKey.val(bip32RootKey);
                return
            }
        }
        hideValidationError();
		console.log('showPending 6 delayedRootKeyChanged'); // MW 241209
        showPending();
        // Clear existing mnemonic and passphrase
        DOM.phrase.val("");
        DOM.phraseSplit.val("");
        DOM.passphrase.val("");
        seed = null;
        if (rootKeyChangedTimeoutEvent != null) {
            clearTimeout(rootKeyChangedTimeoutEvent);
        }
        rootKeyChangedTimeoutEvent = setTimeout(rootKeyChanged, 400);
    }

    function seedChanged() {
		console.log('showPending 7 seedChanged'); // MW 241209
        showPending();
        hideValidationError();
        seed = DOM.seed.val();
        // Test for Bitcoin Cash
        var bch = getDerivationPath();
        if (bch === "m/44'/145'/0'/0")//Bitcoin Cash, BCH
            bip32RootKey = bip32RootKeyClone;
        else
            bip32RootKey = libs.bitcoin.HDNode.fromSeedHex(seed, network);
        var rootKeyBase58 = bip32RootKey.toBase58();
        DOM.rootKey.val(rootKeyBase58);
        var errorText = validateRootKey(rootKeyBase58);
        if (errorText) {
            showValidationError(errorText);
            return;
        }
        // Calculate and display
        calcForDerivationPath();
        calcBip85();
    }

    function rootKeyChanged() {
		console.log('showPending 8 rootKeyChanged'); // MW 241209
        showPending();
        hideValidationError();
        var rootKeyBase58 = DOM.rootKey.val();
        var errorText = validateRootKey(rootKeyBase58);
        if (errorText) {
            showValidationError(errorText);
            return;
        }
        // Calculate and display
        calcBip32RootKeyFromBase58(rootKeyBase58);
        calcForDerivationPath();
        calcBip85();
    }

    function litecoinUseLtubChanged() {
        litecoinUseLtub = DOM.litecoinUseLtub.prop("checked");
        if (litecoinUseLtub) {
            network = libs.bitcoin.networks.litecoin;
        }
        else {
            network = libs.bitcoin.networks.litecoinXprv;
        }
        // Can't use rootKeyChanged because validation will fail as we changed
        // the network but the version bytes stayed as previously.
        seedChanged();
    }

    function toggleSplitMnemonic() {
        if (DOM.showSplitMnemonic.prop("checked")) {
            DOM.splitMnemonic.removeClass("hidden");
        }
        else {
            DOM.splitMnemonic.addClass("hidden");
        }
    }

    function toggleBip85() {
      if (DOM.showBip85.prop('checked')) {
        DOM.bip85.removeClass('hidden');
        calcBip85();
      } else {
        DOM.bip85.addClass('hidden');
      }
    }

    function toggleBip85Fields() {
      if (DOM.showBip85.prop('checked')) {
        DOM.bip85mnemonicLanguageInput.addClass('hidden');
        DOM.bip85mnemonicLengthInput.addClass('hidden');
        DOM.bip85bytesInput.addClass('hidden');

        var app = DOM.bip85application.val();
        if (app === 'bip39') {
          DOM.bip85mnemonicLanguageInput.removeClass('hidden');
          DOM.bip85mnemonicLengthInput.removeClass('hidden');
        } else if (app === 'hex') {
          DOM.bip85bytesInput.removeClass('hidden');
        }
      }
    }

    function calcBip85() {
      if (!DOM.showBip85.prop('checked')) {
        return
      }

      toggleBip85Fields();

      var app = DOM.bip85application.val();

      var rootKeyBase58 = DOM.rootKey.val();
      if (!rootKeyBase58) {
        return;
      }
      try {
        // try parsing using base network params
        // The bip85 lib only understands xpubs, so compute it
        var rootKey = libs.bitcoin.HDNode.fromBase58(rootKeyBase58, network);
        rootKey.keyPair.network = libs.bitcoin.networks['bitcoin']
        var master = libs.bip85.BIP85.fromBase58(rootKey.toBase58());

        var result;

        const index = parseInt(DOM.bip85index.val(), 10);

        if (app === 'bip39') {
          const language = parseInt(DOM.bip85mnemonicLanguage.val(), 10);
          const length = parseInt(DOM.bip85mnemonicLength.val(), 10);

          result = master.deriveBIP39(language, length, index).toMnemonic();
        } else if (app === 'wif') {
          result = master.deriveWIF(index).toWIF();
        } else if (app === 'xprv') {
          result = master.deriveXPRV(index).toXPRV();
        } else if (app === 'hex') {
          const bytes = parseInt(DOM.bip85bytes.val(), 10);

          result = master.deriveHex(bytes, index).toEntropy();
        }

        hideValidationError();
        DOM.bip85Field.val(result);
      } catch (e) {
        showValidationError('BIP85: ' + e.message);
        DOM.bip85Field.val('');
      }
    }

    function calcForDerivationPath() {
        clearDerivedKeys();
        clearAddressesList();
		console.log('showPending 9 calcForDerivationPath'); // MW 241209
        showPending();
        // Don't show segwit if it's selected but network doesn't support it
        if (segwitSelected() && !networkHasSegwit()) {
            showSegwitUnavailable();
			console.log('hidePending 4 calcForDerivationPath'); // MW 241209
            hidePending();
            return;
        }
        showSegwitAvailable();
        // Get the derivation path
        var derivationPath = getDerivationPath();
        var errorText = findDerivationPathErrors(derivationPath);
        if (errorText) {
            showValidationError(errorText);
            return;
        }
        bip32ExtendedKey = calcBip32ExtendedKey(derivationPath);
        if (bip44TabSelected()) {
            displayBip44Info();
        }
        else if (bip49TabSelected()) {
            displayBip49Info();
        }
        else if (bip84TabSelected()) {
            displayBip84Info();
        }
        displayBip32Info();
    }

    function generateClicked() {
        if (isUsingOwnEntropy()) {
            return;
        }
        clearDisplay();
		console.log('showPending 10 generateClicked'); // MW 241209
        showPending();
        setTimeout(function() {
            setMnemonicLanguage();
            var phrase = generateRandomPhrase();
            if (!phrase) {
                return;
            }
            phraseChanged();
        }, 50);
    }

    function languageChanged() {
        setTimeout(function() {
            setMnemonicLanguage();
            if (DOM.phrase.val().length > 0) {
                var newPhrase = convertPhraseToNewLanguage();
                DOM.phrase.val(newPhrase);
                phraseChanged();
            }
            else {
                DOM.generate.trigger("click");
            }
        }, 50);
    }

    function bitcoinCashAddressTypeChange() {
        rootKeyChanged();
    }

    function toggleIndexes() {
        showIndex = !showIndex;
        $("td.index span").toggleClass("invisible");
    }

    function toggleAddresses() {
        showAddress = !showAddress;
        $("td.address span").toggleClass("invisible");
    }

    function togglePublicKeys() {
        showPubKey = !showPubKey;
        $("td.pubkey span").toggleClass("invisible");
    }

    function togglePrivateKeys() {
        showPrivKey = !showPrivKey;
        $("td.privkey span").toggleClass("invisible");
    }

    function privacyScreenToggled() {
        // private-data contains elements added to DOM at runtime
        // so catch all by adding visual privacy class to the root of the DOM
        if (DOM.privacyScreenToggle.prop("checked")) {
            $("body").addClass("visual-privacy");
        }
        else {
            $("body").removeClass("visual-privacy");
        }
    }

    // Private methods

    function generateRandomPhrase() {
        if (!hasStrongRandom()) {
            var errorText = "This browser does not support strong randomness";
            showValidationError(errorText);
            return;
        }
        // get the amount of entropy to use
        var numWords = parseInt(DOM.generatedStrength.val());
        var strength = numWords / 3 * 32;
        var buffer = new Uint8Array(strength / 8);
        // create secure entropy
        var data = crypto.getRandomValues(buffer);
        // show the words
        var words = mnemonic.toMnemonic(data);
        DOM.phrase.val(words);
        // show the entropy
        var entropyHex = uint8ArrayToHex(data);
        DOM.entropy.val(entropyHex);
        // ensure entropy fields are consistent with what is being displayed
        DOM.entropyMnemonicLength.val("raw");
        return words;
    }

    function calcBip32RootKeyFromSeed(phrase, passphrase) {
        seed = mnemonic.toSeed(phrase, passphrase);
        bip32RootKey = libs.bitcoin.HDNode.fromSeedHex(seed, network);
        bip32RootKeyClone = Object.create(bip32RootKey);
        if(isGRS())
			bip32RootKey = libs.groestlcoinjs.HDNode.fromSeedHex(seed, network);
    }

    function calcBip32RootKeyFromBase58(rootKeyBase58) {
        if(isGRS()) {
            calcBip32RootKeyFromBase58GRS(rootKeyBase58);
            return;
        }
        // try parsing with various segwit network params since this extended
        // key may be from any one of them.

        // Test for Bitcoin Cash
        var bch = getDerivationPath();

        if (networkHasSegwit()) {
            var n = network;
            if ("baseNetwork" in n) {
                n = libs.bitcoin.networks[n.baseNetwork];
            }
            // try parsing using base network params
            try {
                if (bch === "m/44'/145'/0'/0")
                    bip32RootKey = bip32RootKeyClone;
                else
                    bip32RootKey = libs.bitcoin.HDNode.fromBase58(rootKeyBase58, n);
                return;
            }
            catch (e) {}
            // try parsing using p2wpkh params
            if ("p2wpkh" in n) {
                try {
                    bip32RootKey = libs.bitcoin.HDNode.fromBase58(rootKeyBase58, n.p2wpkh);
                    return;
                }
                catch (e) {}
            }
            // try parsing using p2wpkh-in-p2sh network params
            if ("p2wpkhInP2sh" in n) {
                try {
                    bip32RootKey = libs.bitcoin.HDNode.fromBase58(rootKeyBase58, n.p2wpkhInP2sh);
                    return;
                }
                catch (e) {}
            }
            // try parsing using p2wsh network params
            if ("p2wsh" in n) {
                try {
                    bip32RootKey = libs.bitcoin.HDNode.fromBase58(rootKeyBase58, n.p2wsh);
                    return;
                }
                catch (e) {}
            }
            // try parsing using p2wsh-in-p2sh network params
            if ("p2wshInP2sh" in n) {
                try {
                    bip32RootKey = libs.bitcoin.HDNode.fromBase58(rootKeyBase58, n.p2wshInP2sh);
                    return;
                }
                catch (e) {}
            }
        }
        // try the network params as currently specified
        bip32RootKey = libs.bitcoin.HDNode.fromBase58(rootKeyBase58, network);
    }

    function calcBip32RootKeyFromBase58GRS(rootKeyBase58) {
        // try parsing with various segwit network params since this extended
        // key may be from any one of them.
        if (networkHasSegwit()) {
            var n = network;
            if ("baseNetwork" in n) {
                n = libs.bitcoin.networks[n.baseNetwork];
            }
            // try parsing using base network params
            try {
                bip32RootKey = libs.groestlcoinjs.HDNode.fromBase58(rootKeyBase58, n);
                return;
            }
            catch (e) {}
            // try parsing using p2wpkh params
            if ("p2wpkh" in n) {
                try {
                    bip32RootKey = libs.groestlcoinjs.HDNode.fromBase58(rootKeyBase58, n.p2wpkh);
                    return;
                }
                catch (e) {}
            }
            // try parsing using p2wpkh-in-p2sh network params
            if ("p2wpkhInP2sh" in n) {
                try {
                    bip32RootKey = libs.groestlcoinjs.HDNode.fromBase58(rootKeyBase58, n.p2wpkhInP2sh);
                    return;
                }
                catch (e) {}
            }
        }
        // try the network params as currently specified
        bip32RootKey = libs.groestlcoinjs.HDNode.fromBase58(rootKeyBase58, network);
    }

    function calcBip32ExtendedKey(path) {
        // Check there's a root key to derive from
        if (!bip32RootKey) {
            return bip32RootKey;
        }
        var extendedKey = bip32RootKey;
        // Derive the key from the path
        var pathBits = path.split("/");
        for (var i=0; i<pathBits.length; i++) {
            var bit = pathBits[i];
            var index = parseInt(bit);
            if (isNaN(index)) {
                continue;
            }
            var hardened = bit[bit.length-1] == "'";
            var isPriv = !(extendedKey.isNeutered());
            var invalidDerivationPath = hardened && !isPriv;
            if (invalidDerivationPath) {
                extendedKey = null;
            }
            else if (hardened) {
                extendedKey = extendedKey.deriveHardened(index);
            }
            else {
                extendedKey = extendedKey.derive(index);
            }
        }
        return extendedKey;
    }

    function showValidationError(errorText) {
        DOM.feedback
            .text(errorText)
            .show();
    }

    function hideValidationError() {
        DOM.feedback
            .text("")
            .hide();
    }

    function findPhraseErrors(phrase) {
        // Preprocess the words
        phrase = mnemonic.normalizeString(phrase);
        var words = phraseToWordArray(phrase);
        // Detect blank phrase
        if (words.length == 0) {
			/* MW 241209*/
			set_phraseM = false;
			phraseM = xmr_failure;
			alc_xmrpublickey = xmr_failure;
			DOM.phraseM.val('');
			Calculating = 0;
			/* MW 241209*/
			return "Blank mnemonic";
        }
        // Check each word
        for (var i=0; i<words.length; i++) {
            var word = words[i];
            var language = getLanguage();
            if (WORDLISTS[language].indexOf(word) == -1) {
                console.log("Finding closest match to " + word);
                var nearestWord = findNearestWord(word);
                return word + " not in wordlist, did you mean " + nearestWord + "?";
            }
        }
        // Check the words are valid
        var properPhrase = wordArrayToPhrase(words);
        var isValid = mnemonic.check(properPhrase);
        if (!isValid) {
            return "Invalid mnemonic";
        }
        return false;
    }

    function validateRootKey(rootKeyBase58) {
        if(isGRS())
            return validateRootKeyGRS(rootKeyBase58);

        // try various segwit network params since this extended key may be from
        // any one of them.
        if (networkHasSegwit()) {
            var n = network;
            if ("baseNetwork" in n) {
                n = libs.bitcoin.networks[n.baseNetwork];
            }
            // try parsing using base network params
            try {
                libs.bitcoin.HDNode.fromBase58(rootKeyBase58, n);
                return "";
            }
            catch (e) {}
            // try parsing using p2wpkh params
            if ("p2wpkh" in n) {
                try {
                    libs.bitcoin.HDNode.fromBase58(rootKeyBase58, n.p2wpkh);
                    return "";
                }
                catch (e) {}
            }
            // try parsing using p2wpkh-in-p2sh network params
            if ("p2wpkhInP2sh" in n) {
                try {
                    libs.bitcoin.HDNode.fromBase58(rootKeyBase58, n.p2wpkhInP2sh);
                    return "";
                }
                catch (e) {}
            }
            // try parsing using p2wsh network params
            if ("p2wsh" in n) {
                try {
                    libs.bitcoin.HDNode.fromBase58(rootKeyBase58, n.p2wsh);
                    return "";
                }
                catch (e) {}
            }
            // try parsing using p2wsh-in-p2sh network params
            if ("p2wshInP2sh" in n) {
                try {
                    libs.bitcoin.HDNode.fromBase58(rootKeyBase58, n.p2wshInP2sh);
                    return "";
                }
                catch (e) {}
            }
        }
        // try the network params as currently specified
        try {
            libs.bitcoin.HDNode.fromBase58(rootKeyBase58, network);
        }
        catch (e) {
            return "Invalid root key";
        }
        return "";
    }

    function validateRootKeyGRS(rootKeyBase58) {
        // try various segwit network params since this extended key may be from
        // any one of them.
        if (networkHasSegwit()) {
            var n = network;
            if ("baseNetwork" in n) {
                n = libs.bitcoin.networks[n.baseNetwork];
            }
            // try parsing using base network params
            try {
                libs.groestlcoinjs.HDNode.fromBase58(rootKeyBase58, n);
                return "";
            }
            catch (e) {}
            // try parsing using p2wpkh params
            if ("p2wpkh" in n) {
                try {
                    libs.groestlcoinjs.HDNode.fromBase58(rootKeyBase58, n.p2wpkh);
                    return "";
                }
                catch (e) {}
            }
            // try parsing using p2wpkh-in-p2sh network params
            if ("p2wpkhInP2sh" in n) {
                try {
                    libs.groestlcoinjs.HDNode.fromBase58(rootKeyBase58, n.p2wpkhInP2sh);
                    return "";
                }
                catch (e) {}
            }
        }
        // try the network params as currently specified
        try {
            libs.groestlcoinjs.HDNode.fromBase58(rootKeyBase58, network);
        }
        catch (e) {
            return "Invalid root key";
        }
        return "";
    }

    function getDerivationPath() {
        if (bip44TabSelected()) {
            var purpose = parseIntNoNaN(DOM.bip44purpose.val(), 44);
            var coin = parseIntNoNaN(DOM.bip44coin.val(), 0);
            var account = parseIntNoNaN(DOM.bip44account.val(), 0);
            var change = parseIntNoNaN(DOM.bip44change.val(), 0);
            var path = "m/";
            path += purpose + "'/";
            path += coin + "'/";
            path += account + "'/";
            path += change;
            DOM.bip44path.val(path);
            var derivationPath = DOM.bip44path.val();
            return derivationPath;
        }
        else if (bip49TabSelected()) {
            var purpose = parseIntNoNaN(DOM.bip49purpose.val(), 49);
            var coin = parseIntNoNaN(DOM.bip49coin.val(), 0);
            var account = parseIntNoNaN(DOM.bip49account.val(), 0);
            var change = parseIntNoNaN(DOM.bip49change.val(), 0);
            var path = "m/";
            path += purpose + "'/";
            path += coin + "'/";
            path += account + "'/";
            path += change;
            DOM.bip49path.val(path);
            var derivationPath = DOM.bip49path.val();
            return derivationPath;
        }
        else if (bip84TabSelected()) {
            var purpose = parseIntNoNaN(DOM.bip84purpose.val(), 84);
            var coin = parseIntNoNaN(DOM.bip84coin.val(), 0);
            var account = parseIntNoNaN(DOM.bip84account.val(), 0);
            var change = parseIntNoNaN(DOM.bip84change.val(), 0);
            var path = "m/";
            path += purpose + "'/";
            path += coin + "'/";
            path += account + "'/";
            path += change;
            DOM.bip84path.val(path);
            var derivationPath = DOM.bip84path.val();
            return derivationPath;
        }
        else if (bip32TabSelected()) {
            var derivationPath = DOM.bip32path.val();
            return derivationPath;
        }
        else if (bip141TabSelected()) {
            var derivationPath = DOM.bip141path.val();
            return derivationPath;
        }
        else {
            console.log("Unknown derivation path");
        }
    }

    function findDerivationPathErrors(path) {
        // TODO is not perfect but is better than nothing
        // Inspired by
        // https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#test-vectors
        // and
        // https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#extended-keys
        var maxDepth = 255; // TODO verify this!!
        var maxIndexValue = Math.pow(2, 31); // TODO verify this!!
        if (path[0] != "m") {
            return "First character must be 'm'";
        }
        if (path.length > 1) {
            if (path[1] != "/") {
                return "Separator must be '/'";
            }
            var indexes = path.split("/");
            if (indexes.length > maxDepth) {
                return "Derivation depth is " + indexes.length + ", must be less than " + maxDepth;
            }
            for (var depth = 1; depth<indexes.length; depth++) {
                var index = indexes[depth];
                var invalidChars = index.replace(/^[0-9]+'?$/g, "")
                if (invalidChars.length > 0) {
                    return "Invalid characters " + invalidChars + " found at depth " + depth;
                }
                var indexValue = parseInt(index.replace("'", ""));
                if (isNaN(depth)) {
                    return "Invalid number at depth " + depth;
                }
                if (indexValue > maxIndexValue) {
                    return "Value of " + indexValue + " at depth " + depth + " must be less than " + maxIndexValue;
                }
            }
        }
        // Check root key exists or else derivation path is useless!
        if (!bip32RootKey) {
            return "No root key";
        }
        // Check no hardened derivation path when using xpub keys
        var hardenedPath = path.indexOf("'") > -1;
        var hardenedAddresses = bip32TabSelected() && DOM.hardenedAddresses.prop("checked");
        var hardened = hardenedPath || hardenedAddresses;
        var isXpubkey = bip32RootKey.isNeutered();
        if (hardened && isXpubkey) {
            return "Hardened derivation path is invalid with xpub key";
        }
        return false;
    }

    function isGRS() {
        return networks[DOM.network.val()].name == "GRS - Groestlcoin" || networks[DOM.network.val()].name == "GRS - Groestlcoin Testnet";
    }

    function isELA() {
        return networks[DOM.network.val()].name == "ELA - Elastos"
    }

    function displayBip44Info() {
        // Get the derivation path for the account
        var purpose = parseIntNoNaN(DOM.bip44purpose.val(), 44);
        var coin = parseIntNoNaN(DOM.bip44coin.val(), 0);
        var account = parseIntNoNaN(DOM.bip44account.val(), 0);
        var path = "m/";
        path += purpose + "'/";
        path += coin + "'/";
        path += account + "'/";
        // Calculate the account extended keys
        var accountExtendedKey = calcBip32ExtendedKey(path);
        var accountXprv = accountExtendedKey.toBase58();
        var accountXpub = accountExtendedKey.neutered().toBase58();

        // Display the extended keys
        DOM.bip44accountXprv.val(accountXprv);
        DOM.bip44accountXpub.val(accountXpub);

        if (isELA()) {
            displayBip44InfoForELA();
        }
    }

    function displayBip49Info() {
        // Get the derivation path for the account
        var purpose = parseIntNoNaN(DOM.bip49purpose.val(), 49);
        var coin = parseIntNoNaN(DOM.bip49coin.val(), 0);
        var account = parseIntNoNaN(DOM.bip49account.val(), 0);
        var path = "m/";
        path += purpose + "'/";
        path += coin + "'/";
        path += account + "'/";
        // Calculate the account extended keys
        var accountExtendedKey = calcBip32ExtendedKey(path);
        var accountXprv = accountExtendedKey.toBase58();
        var accountXpub = accountExtendedKey.neutered().toBase58();
        // Display the extended keys
        DOM.bip49accountXprv.val(accountXprv);
        DOM.bip49accountXpub.val(accountXpub);
    }

    function displayBip84Info() {
        // Get the derivation path for the account
        var purpose = parseIntNoNaN(DOM.bip84purpose.val(), 84);
        var coin = parseIntNoNaN(DOM.bip84coin.val(), 0);
        var account = parseIntNoNaN(DOM.bip84account.val(), 0);
        var path = "m/";
        path += purpose + "'/";
        path += coin + "'/";
        path += account + "'/";
        // Calculate the account extended keys
        var accountExtendedKey = calcBip32ExtendedKey(path);
        var accountXprv = accountExtendedKey.toBase58();
        var accountXpub = accountExtendedKey.neutered().toBase58();
        // Display the extended keys
        DOM.bip84accountXprv.val(accountXprv);
        DOM.bip84accountXpub.val(accountXpub);
    }

    function displayBip32Info() {
        // Display the key
        DOM.seed.val(seed);
        var rootKey = bip32RootKey.toBase58();
        DOM.rootKey.val(rootKey);
        var xprvkeyB58 = "NA";
        if (!bip32ExtendedKey.isNeutered()) {
            xprvkeyB58 = bip32ExtendedKey.toBase58();
        }
        var extendedPrivKey = xprvkeyB58;
        DOM.extendedPrivKey.val(extendedPrivKey);
        var extendedPubKey = bip32ExtendedKey.neutered().toBase58();
        DOM.extendedPubKey.val(extendedPubKey);
        // Display the addresses and privkeys
        clearAddressesList();
        var initialAddressCount = parseInt(DOM.rowsToAdd.val());
        displayAddresses(0, initialAddressCount);

        if (isELA()) {
            displayBip32InfoForELA();
        }
    }

    async function displayAddresses(start, total) {
        if (networks[DOM.network.val()].name != "XMR - Monero" && alc_shownXMR) {
            var daTableThead = document.getElementById('da-table-thead');

            const daThead = document.createElement("thead");
			daThead.id = "da-table-thead";

            const daTh1 = document.createElement("th");
			const daDiv1 = document.createElement("div");
			daDiv1.classList.add('input-group');
            const daSpan1 = document.createElement("span");
            const daSpanText1 = document.createTextNode('Path');
            daSpan1.appendChild(daSpanText1);
            daDiv1.appendChild(daSpan1);
			//
			const daNbsp1 = document.createTextNode('\u00a0\u00a0');
			daDiv1.appendChild(daNbsp1);
			//
			const daButton1 = document.createElement("button");
            const daButtonText1 = document.createTextNode('Toggle');
            daButton1.appendChild(daButtonText1);
			daButton1.classList.add('index-toggle');
			daDiv1.appendChild(daButton1);
			//
			daTh1.appendChild(daDiv1);
			daThead.appendChild(daTh1);

            const daTh2 = document.createElement("th");
			const daDiv2 = document.createElement("div");
			daDiv2.class = "input-group";
            const daSpan2 = document.createElement("span");
            const daSpanText2 = document.createTextNode('Address');
            daSpan2.appendChild(daSpanText2);
            daDiv2.appendChild(daSpan2);
			//
			const daNbsp2 = document.createTextNode('\u00a0\u00a0');
			daDiv2.appendChild(daNbsp2);
			//
			const daButton2 = document.createElement("button");
            const daButtonText2 = document.createTextNode('Toggle');
            daButton2.appendChild(daButtonText2);
			daButton2.classList.add('address-toggle');
			daDiv2.appendChild(daButton2);
			//
			daTh2.appendChild(daDiv2);
			daThead.appendChild(daTh2);

            const daTh3 = document.createElement("th");
			const daDiv3 = document.createElement("div");
			daDiv3.class = "input-group";
            const daSpan3 = document.createElement("span");
            const daSpanText3 = document.createTextNode('Public Key');
            daSpan3.appendChild(daSpanText3);
            daDiv3.appendChild(daSpan3);
			//
			const daNbsp3 = document.createTextNode('\u00a0\u00a0');
			daDiv3.appendChild(daNbsp3);
			//
			const daButton3 = document.createElement("button");
            const daButtonText3 = document.createTextNode('Toggle');
            daButton3.appendChild(daButtonText3);
			daButton3.classList.add('public-key-toggle');
			daDiv3.appendChild(daButton3);
			//
			daTh3.appendChild(daDiv3);
			daThead.appendChild(daTh3);

            const daTh4 = document.createElement("th");
			const daDiv4 = document.createElement("div");
			daDiv4.class = "input-group";
            const daSpan4 = document.createElement("span");
            const daSpanText4 = document.createTextNode('Private Key');
            daSpan4.appendChild(daSpanText4);
            daDiv4.appendChild(daSpan4);
			//
			const daNbsp4 = document.createTextNode('\u00a0\u00a0');
			daDiv4.appendChild(daNbsp4);
			//
			const daButton4 = document.createElement("button");
            const daButtonText4 = document.createTextNode('Toggle');
            daButton4.appendChild(daButtonText4);
			daButton4.classList.add('private-key-toggle');
			daDiv4.appendChild(daButton4);
			//
			daTh4.appendChild(daDiv4);
			daThead.appendChild(daTh4);

            // replace <thead>
            daTableThead.parentNode.replaceChild(daThead, daTableThead);

            DOM.indexToggle = $(".index-toggle");
            DOM.indexToggle.on("click", toggleIndexes);
            DOM.addressToggle = $(".address-toggle");
            DOM.addressToggle.on("click", toggleAddresses);
            DOM.publicKeyToggle = $(".public-key-toggle");
            DOM.publicKeyToggle.on("click", togglePublicKeys);
            DOM.privateKeyToggle = $(".private-key-toggle");
            DOM.privateKeyToggle.on("click", togglePrivateKeys);
			
			alc_shownXMR = false;
		}
		else
		if (networks[DOM.network.val()].name == "XMR - Monero") {
            var daTableThead = document.getElementById('da-table-thead');

            const daThead = document.createElement("thead");
			daThead.id = "da-table-thead";

            const daTh1 = document.createElement("th");
			const daDiv1 = document.createElement("div");
			daDiv1.class = "input-group";
            const daSpan1 = document.createElement("span");
            const daSpanText1 = document.createTextNode('Path');
            daSpan1.appendChild(daSpanText1);
            daDiv1.appendChild(daSpan1);
			//
			daTh1.appendChild(daDiv1);
			daThead.appendChild(daTh1);

            const daTh2 = document.createElement("th");
			const daDiv2 = document.createElement("div");
			daDiv2.class = "input-group";
            const daSpan2 = document.createElement("span");
            const daSpanText2 = document.createTextNode('Subaddress');
            daSpan2.appendChild(daSpanText2);
            daDiv2.appendChild(daSpan2);
			//
			daTh2.appendChild(daDiv2);
			daThead.appendChild(daTh2);

            // replace <thead>
            daTableThead.parentNode.replaceChild(daThead, daTableThead);
			
			alc_shownXMR = true;
		}

        generationProcesses.push(new (function() {

            var rows = [];

            this.stop = function() {
                for (var i=0; i<rows.length; i++) {
                    rows[i].shouldGenerate = false;
                }
				console.log('hidePending 5 generationProcesses.push'); // MW 241209
                hidePending();
            }

            for (var i=0; i<total; i++) {
                var index = i + start;
                var isLast = i == total - 1;
                rows.push(new TableRow(index, isLast));
            }

        })());
    }

    function segwitSelected() {
        return bip49TabSelected() || bip84TabSelected() || bip141TabSelected();
    }

    function p2wpkhSelected() {
        return bip84TabSelected() ||
                bip141TabSelected() && DOM.bip141semantics.val() == "p2wpkh";
    }

    function p2wpkhInP2shSelected() {
        return bip49TabSelected() ||
            (bip141TabSelected() && DOM.bip141semantics.val() == "p2wpkh-p2sh");
    }

    function p2wshSelected() {
        return bip141TabSelected() && DOM.bip141semantics.val() == "p2wsh";
    }

    function p2wshInP2shSelected() {
        return (bip141TabSelected() && DOM.bip141semantics.val() == "p2wsh-p2sh");
    }

    function TableRow(index, isLast) {

		var self = this;
        this.shouldGenerate = true;
        var useHardenedAddresses = DOM.hardenedAddresses.prop("checked");
        var useBip38 = DOM.useBip38.prop("checked");
        var bip38password = DOM.bip38Password.val();
        var isSegwit = segwitSelected();
        var segwitAvailable = networkHasSegwit();
        var isP2wpkh = p2wpkhSelected();
        var isP2wpkhInP2sh = p2wpkhInP2shSelected();
        var isP2wsh = p2wshSelected();
        var isP2wshInP2sh = p2wshInP2shSelected();

        function init() {
            calculateValues();
        }

        function calculateValues() {
            setTimeout(function() {
                if (!self.shouldGenerate) {
                    return;
                }
                // derive HDkey for this row of the table
                var key = "NA";
                if (useHardenedAddresses) {
                    key = bip32ExtendedKey.deriveHardened(index);
                }
                else {
                    key = bip32ExtendedKey.derive(index);
                }

                // bip38 requires uncompressed keys
                // see https://github.com/iancoleman/bip39/issues/140#issuecomment-352164035
                var keyPair = key.keyPair;
                var useUncompressed = useBip38;
                if (useUncompressed) {
                    keyPair = new libs.bitcoin.ECPair(keyPair.d, null, { network: network, compressed: false });
                    if(isGRS())
                        keyPair = new libs.groestlcoinjs.ECPair(keyPair.d, null, { network: network, compressed: false });

                }
                // get address
                var address = keyPair.getAddress().toString();
                // get privkey
                var hasPrivkey = !key.isNeutered();
                var privkey = "NA";
                if (hasPrivkey) {
                    privkey = keyPair.toWIF();
                    // BIP38 encode private key if required
                    if (useBip38) {
                        if(isGRS())
                            privkey = libs.groestlcoinjsBip38.encrypt(keyPair.d.toBuffer(), false, bip38password, function(p) {
                                console.log("Progressed " + p.percent.toFixed(1) + "% for index " + index);
                            }, null, networks[DOM.network.val()].name.includes("Testnet"));
                        else
                            privkey = libs.bip38.encrypt(keyPair.d.toBuffer(), false, bip38password, function(p) {
                                console.log("Progressed " + p.percent.toFixed(1) + "% for index " + index);
                            });
                    }
                }
                // get pubkey
                var pubkey = keyPair.getPublicKeyBuffer().toString('hex');
                var indexText = getDerivationPath() + "/" + index;
                if (useHardenedAddresses) {
                    indexText = indexText + "'";
                }
                // Ethereum values are different
                if (networkIsEthereum()) {
                    var pubkeyBuffer = keyPair.getPublicKeyBuffer();
                    var ethPubkey = libs.ethUtil.importPublic(pubkeyBuffer);
                    var addressBuffer = libs.ethUtil.publicToAddress(ethPubkey);
                    var hexAddress = addressBuffer.toString('hex');
                    var checksumAddress = libs.ethUtil.toChecksumAddress(hexAddress);
                    address = libs.ethUtil.addHexPrefix(checksumAddress);
                    pubkey = libs.ethUtil.addHexPrefix(pubkey);
                    if (hasPrivkey) {
                        privkey = libs.ethUtil.bufferToHex(keyPair.d.toBuffer(32));
                    }
                }
				//Monero is different
                if (networks[DOM.network.val()].name == "XMR - Monero") {
					privkey = "NA";
					pubkey = mn_subaddress.getSubaddress(alc_xmrprivateview, alc_xmrpublicspend, 0, index);
				}
                //TRX is different
                if (networks[DOM.network.val()].name == "TRX - Tron") {
                    keyPair = new libs.bitcoin.ECPair(keyPair.d, null, { network: network, compressed: false });
                    var pubkeyBuffer = keyPair.getPublicKeyBuffer();
                    var ethPubkey = libs.ethUtil.importPublic(pubkeyBuffer);
                    var addressBuffer = libs.ethUtil.publicToAddress(ethPubkey);
                    address = libs.bitcoin.address.toBase58Check(addressBuffer, 0x41);
                    if (hasPrivkey) {
                        privkey = keyPair.d.toBuffer().toString('hex');
                    }
                }

                // RSK values are different
                if (networkIsRsk()) {
                    var pubkeyBuffer = keyPair.getPublicKeyBuffer();
                    var ethPubkey = libs.ethUtil.importPublic(pubkeyBuffer);
                    var addressBuffer = libs.ethUtil.publicToAddress(ethPubkey);
                    var hexAddress = addressBuffer.toString('hex');
                    // Use chainId based on selected network
                    // Ref: https://developers.rsk.co/rsk/architecture/account-based/#chainid
                    var chainId;
                    var rskNetworkName = networks[DOM.network.val()].name;
                    switch (rskNetworkName) {
                        case "R-BTC - RSK":
                            chainId = 30;
                            break;
                        case "tR-BTC - RSK Testnet":
                            chainId = 31;
                            break;
                        default:
                            chainId = null;
                    }
                    var checksumAddress = toChecksumAddressForRsk(hexAddress, chainId);
                    address = libs.ethUtil.addHexPrefix(checksumAddress);
                    pubkey = libs.ethUtil.addHexPrefix(pubkey);
                    if (hasPrivkey) {
                        privkey = libs.ethUtil.bufferToHex(keyPair.d.toBuffer());
                    }
                }

                // Handshake values are different
                if (networks[DOM.network.val()].name == "HNS - Handshake") {
                    var ring = libs.handshake.KeyRing.fromPublic(keyPair.getPublicKeyBuffer())
                    address = ring.getAddress().toString();
                }

                // Stellar is different
                if (networks[DOM.network.val()].name == "XLM - Stellar") {
                    var purpose = parseIntNoNaN(DOM.bip44purpose.val(), 44);
                    var coin = parseIntNoNaN(DOM.bip44coin.val(), 0);
                    var path = "m/";
                        path += purpose + "'/";
                        path += coin + "'/" + index + "'";
                    var keypair = libs.stellarUtil.getKeypair(path, seed);
                    indexText = path;
                    privkey = keypair.secret();
                    pubkey = address = keypair.publicKey();
                }

                // Nano currency
                if (networks[DOM.network.val()].name == "NANO - Nano") {
                    var nanoKeypair = libs.nanoUtil.getKeypair(index, seed);
                    privkey = nanoKeypair.privKey;
                    pubkey = nanoKeypair.pubKey;
                    address = nanoKeypair.address;
                }

                if ((networks[DOM.network.val()].name == "NAS - Nebulas")) {
                    var privKeyBuffer = keyPair.d.toBuffer(32);
                    var nebulasAccount = libs.nebulas.Account.NewAccount();
                    nebulasAccount.setPrivateKey(privKeyBuffer);
                    address = nebulasAccount.getAddressString();
                    privkey = nebulasAccount.getPrivateKeyString();
                    pubkey = nebulasAccount.getPublicKeyString();
                }
                // Ripple values are different
                if (networks[DOM.network.val()].name == "XRP - Ripple") {
                    privkey = convertRipplePriv(privkey);
                    address = convertRippleAdrr(address);
                }
                // Jingtum values are different
                if (networks[DOM.network.val()].name == "SWTC - Jingtum") {
                    privkey = convertJingtumPriv(privkey);
                    address = convertJingtumAdrr(address);
                }
                // CasinoCoin values are different
                if (networks[DOM.network.val()].name == "CSC - CasinoCoin") {
                    privkey = convertCasinoCoinPriv(privkey);
                    address = convertCasinoCoinAdrr(address);
                }
                // Bitcoin Cash address format may vary
                if (networks[DOM.network.val()].name == "BCH - Bitcoin Cash") {
                    var bchAddrType = DOM.bitcoinCashAddressType.filter(":checked").val();
                    if (bchAddrType == "cashaddr") {
                        address = libs.bchaddr.toCashAddress(address);
                    }
                    else if (bchAddrType == "bitpay") {
                        address = libs.bchaddr.toBitpayAddress(address);
                    }
                }
                 // Bitcoin Cash address format may vary
                 if (networks[DOM.network.val()].name == "SLP - Simple Ledger Protocol") {
                     var bchAddrType = DOM.bitcoinCashAddressType.filter(":checked").val();
                     if (bchAddrType == "cashaddr") {
                         address = libs.bchaddrSlp.toSlpAddress(address);
                     }
                 }

                // ZooBC address format may vary
                if (networks[DOM.network.val()].name == "ZBC - ZooBlockchain") {

                    var purpose = parseIntNoNaN(DOM.bip44purpose.val(), 44);
                    var coin = parseIntNoNaN(DOM.bip44coin.val(), 0);
                    var path = "m/";
                        path += purpose + "'/";
                        path += coin + "'/" + index + "'";
                    var result = libs.zoobcUtil.getKeypair(path, seed);

                    let publicKey = result.pubKey.slice(1, 33);
                    let privateKey = result.key;

                    privkey = privateKey.toString('hex');
                    pubkey = publicKey.toString('hex');

                    indexText = path;
                    address = libs.zoobcUtil.getZBCAddress(publicKey, 'ZBC');
                }

                // Segwit addresses are different
                if (isSegwit) {
                    if (!segwitAvailable) {
                        return;
                    }
                    if (isP2wpkh) {
                        var keyhash = libs.bitcoin.crypto.hash160(key.getPublicKeyBuffer());
                        var scriptpubkey = libs.bitcoin.script.witnessPubKeyHash.output.encode(keyhash);
                        address = libs.bitcoin.address.fromOutputScript(scriptpubkey, network)
                    }
                    else if (isP2wpkhInP2sh) {
                        var keyhash = libs.bitcoin.crypto.hash160(key.getPublicKeyBuffer());
                        var scriptsig = libs.bitcoin.script.witnessPubKeyHash.output.encode(keyhash);
                        var addressbytes = libs.bitcoin.crypto.hash160(scriptsig);
                        var scriptpubkey = libs.bitcoin.script.scriptHash.output.encode(addressbytes);
                        address = libs.bitcoin.address.fromOutputScript(scriptpubkey, network)
                    }
                    else if (isP2wsh) {
                        // https://github.com/libs.bitcoinjs-lib/blob/v3.3.2/test/integration/addresses.js#L71
                        // This is a 1-of-1
                        var witnessScript = libs.bitcoin.script.multisig.output.encode(1, [key.getPublicKeyBuffer()]);
                        var scriptPubKey = libs.bitcoin.script.witnessScriptHash.output.encode(libs.bitcoin.crypto.sha256(witnessScript));
                        address = libs.bitcoin.address.fromOutputScript(scriptPubKey, network);
                    }
                    else if (isP2wshInP2sh) {
                        // https://github.com/libs.bitcoinjs-lib/blob/v3.3.2/test/integration/transactions.js#L183
                        // This is a 1-of-1
                        var witnessScript = libs.bitcoin.script.multisig.output.encode(1, [key.getPublicKeyBuffer()]);
                        var redeemScript = libs.bitcoin.script.witnessScriptHash.output.encode(libs.bitcoin.crypto.sha256(witnessScript));
                        var scriptPubKey = libs.bitcoin.script.scriptHash.output.encode(libs.bitcoin.crypto.hash160(redeemScript));
                        address = libs.bitcoin.address.fromOutputScript(scriptPubKey, network)
                    }
                }

                if ((networks[DOM.network.val()].name == "CRW - Crown")) {
                    address = libs.bitcoin.networks.crown.toNewAddress(address);
                }

              if (networks[DOM.network.val()].name == "EOS - EOSIO") {
                    address = ""
                    pubkey = EOSbufferToPublic(keyPair.getPublicKeyBuffer());
                    privkey = EOSbufferToPrivate(keyPair.d.toBuffer(32));
                }

                if (networks[DOM.network.val()].name == "FIO - Foundation for Interwallet Operability") {
                    address = ""
                    pubkey = FIObufferToPublic(keyPair.getPublicKeyBuffer());
                    privkey = FIObufferToPrivate(keyPair.d.toBuffer(32));
                }

                if (networks[DOM.network.val()].name == "ATOM - Cosmos Hub") {
                    const hrp = "cosmos";
                    address = CosmosBufferToAddress(keyPair.getPublicKeyBuffer(), hrp);
                    pubkey = CosmosBufferToPublic(keyPair.getPublicKeyBuffer(), hrp);
                    privkey = keyPair.d.toBuffer().toString("base64");
                }

                if (networks[DOM.network.val()].name == "RUNE - THORChain") {
                     const hrp = "thor";
                     address = CosmosBufferToAddress(keyPair.getPublicKeyBuffer(), hrp);
                     pubkey = keyPair.getPublicKeyBuffer().toString("hex");
                     privkey = keyPair.d.toBuffer().toString("hex");
                }

                if (networks[DOM.network.val()].name == "XWC - Whitecoin"){
                    address = XWCbufferToAddress(keyPair.getPublicKeyBuffer());
                    pubkey = XWCbufferToPublic(keyPair.getPublicKeyBuffer());
                    privkey = XWCbufferToPrivate(keyPair.d.toBuffer(32));
                }

                if (networks[DOM.network.val()].name == "LUNA - Terra") {
                    const hrp = "terra";
                    address = CosmosBufferToAddress(keyPair.getPublicKeyBuffer(), hrp);
                    pubkey = keyPair.getPublicKeyBuffer().toString("hex");
                    privkey = keyPair.d.toBuffer().toString("hex");
                }

                if (networks[DOM.network.val()].name == "IOV - Starname") {
                  const hrp = "star";
                  address = CosmosBufferToAddress(keyPair.getPublicKeyBuffer(), hrp);
                  pubkey = CosmosBufferToPublic(keyPair.getPublicKeyBuffer(), hrp);
                  privkey = keyPair.d.toBuffer().toString("base64");
                }

              //Groestlcoin Addresses are different
                if(isGRS()) {

                    if (isSegwit) {
                        if (!segwitAvailable) {
                            return;
                        }
                        if (isP2wpkh) {
                            address = libs.groestlcoinjs.address.fromOutputScript(scriptpubkey, network)
                        }
                        else if (isP2wpkhInP2sh) {
                            address = libs.groestlcoinjs.address.fromOutputScript(scriptpubkey, network)
                        }
                    }
                    //non-segwit addresses are handled by using groestlcoinjs for bip32RootKey
                }

                if (isELA()) {
                    let elaAddress = calcAddressForELA(
                        seed,
                        parseIntNoNaN(DOM.bip44coin.val(), 0),
                        parseIntNoNaN(DOM.bip44account.val(), 0),
                        parseIntNoNaN(DOM.bip44change.val(), 0),
                        index
                    );
                    address = elaAddress.address;
                    privkey = elaAddress.privateKey;
                    pubkey = elaAddress.publicKey;
                }

                addAddressToList(indexText, address, pubkey, privkey);
                if (isLast) {
					console.log('hadEntropy =',hadEntropy); // MW 241209
                    if (!hadEntropy) { console.log('hidePending 6 calculateValues'); hidePending(); } // MW 240904
					//else MW 241209
					console.log('Calculating =',Calculating); // MW 241209
					if (Calculating > 3) { console.log('FINAL KICK'); hidePending(); } // MW 241209
                    updateCsv();
                }
            }, 50)
        }

        init();

    }

    function showMore() {
        var rowsToAdd = parseInt(DOM.rowsToAdd.val());
        if (isNaN(rowsToAdd)) {
            rowsToAdd = 20;
            DOM.rowsToAdd.val("20");
        }
        var start = parseInt(DOM.moreRowsStartIndex.val())
        if (isNaN(start)) {
            start = lastIndexInTable() + 1;
        }
        else {
            var newStart = start + rowsToAdd;
            DOM.moreRowsStartIndex.val(newStart);
        }
        if (rowsToAdd > 200) {
            var msg = "Generating " + rowsToAdd + " rows could take a while. ";
            msg += "Do you want to continue?";
            if (!confirm(msg)) {
                return;
            }
        }
        displayAddresses(start, rowsToAdd);
    }

    function clearDisplay() {
        clearAddressesList();
        clearKeys();
        hideValidationError();
    }

    function clearAddressesList() {
        DOM.addresses.empty();
        DOM.csv.val("");
        stopGenerating();
    }

    function stopGenerating() {
        while (generationProcesses.length > 0) {
            var generation = generationProcesses.shift();
            generation.stop();
        }
    }

    function clearKeys() {
        clearRootKey();
        clearDerivedKeys();
    }

    function clearRootKey() {
        DOM.rootKey.val("");
    }

    function clearDerivedKeys() {
        DOM.extendedPrivKey.val("");
        DOM.extendedPubKey.val("");
        DOM.bip44accountXprv.val("");
        DOM.bip44accountXpub.val("");
    }

    function addAddressToList(indexText, address, pubkey, privkey) {
        var row = $(addressRowTemplate.html());
        // Elements
        var indexCell = row.find(".index span");
        var addressCell = row.find(".address span");
        var pubkeyCell = row.find(".pubkey span");
        var privkeyCell = row.find(".privkey span");
        // Content
        indexCell.text(indexText);
        addressCell.text(address);
        pubkeyCell.text(pubkey);
        privkeyCell.text(privkey);
		if (networks[DOM.network.val()].name == "XMR - Monero") {
			addressCell.text(pubkey);
			pubkeyCell.text('');
			privkeyCell.text('');
		}
        // Visibility
        if (!showIndex) {
            indexCell.addClass("invisible");
        }
        if (!showAddress) {
            addressCell.addClass("invisible");
        }
        if (!showPubKey) {
            pubkeyCell.addClass("invisible");
        }
        if (!showPrivKey) {
            privkeyCell.addClass("invisible");
        }
        DOM.addresses.append(row);
        var rowShowQrEls = row.find("[data-show-qr]");
        setQrEvents(rowShowQrEls);
    }

    function hasStrongRandom() {
        return 'crypto' in window && window['crypto'] !== null;
    }

    function disableForms() {
        $("form").on("submit", function(e) {
            e.preventDefault();
        });
    }

    function parseIntNoNaN(val, defaultVal) {
        var v = parseInt(val);
        if (isNaN(v)) {
            return defaultVal;
        }
        return v;
    }

    function showPending() {
		Calculating = Calculating + 1; // MW 241209
        DOM.feedback
            .text("Calculating...")
            .show();
    }

    function findNearestWord(word) {
        var language = getLanguage();
        var words = WORDLISTS[language];
        var minDistance = 99;
        var closestWord = words[0];
        for (var i=0; i<words.length; i++) {
            var comparedTo = words[i];
            if (comparedTo.indexOf(word) == 0) {
                return comparedTo;
            }
            var distance = libs.levenshtein.get(word, comparedTo);
            if (distance < minDistance) {
                closestWord = comparedTo;
                minDistance = distance;
            }
        }
        return closestWord;
    }

    function hidePending() {
        DOM.feedback
            .text("")
            .hide();
    }

    function populateNetworkSelect() {
        for (var i=0; i<networks.length; i++) {
            var network = networks[i];
            var option = $("<option>");
            option.attr("value", i);
            option.text(network.name);
            if (network.name == "BTC - Bitcoin") {
                option.prop("selected", true);
            }
            DOM.phraseNetwork.append(option);
        }
    }

    function populateClientSelect() {
        for (var i=0; i<clients.length; i++) {
            var client = clients[i];
            var option = $("<option>");
            option.attr("value", i);
            option.text(client.name);
            DOM.bip32Client.append(option);
        }
    }

    function getLanguage() {
        var defaultLanguage = "english";
        // Try to get from existing phrase
        var language = getLanguageFromPhrase();
        // Try to get from url if not from phrase
        if (language.length == 0) {
            language = getLanguageFromUrl();
        }
        // Default to English if no other option
        if (language.length == 0) {
            language = defaultLanguage;
        }
        return language;
    }

    function getLanguageFromPhrase(phrase) {
        // Check if how many words from existing phrase match a language.
        var language = "";
        if (!phrase) {
            phrase = DOM.phrase.val();
        }
        if (phrase.length > 0) {
            var words = phraseToWordArray(phrase);
            var languageMatches = {};
            for (l in WORDLISTS) {
                // Track how many words match in this language
                languageMatches[l] = 0;
                for (var i=0; i<words.length; i++) {
                    var wordInLanguage = WORDLISTS[l].indexOf(words[i]) > -1;
                    if (wordInLanguage) {
                        languageMatches[l]++;
                    }
                }
                // Find languages with most word matches.
                // This is made difficult due to commonalities between Chinese
                // simplified vs traditional.
                var mostMatches = 0;
                var mostMatchedLanguages = [];
                for (var l in languageMatches) {
                    var numMatches = languageMatches[l];
                    if (numMatches > mostMatches) {
                        mostMatches = numMatches;
                        mostMatchedLanguages = [l];
                    }
                    else if (numMatches == mostMatches) {
                        mostMatchedLanguages.push(l);
                    }
                }
            }
            if (mostMatchedLanguages.length > 0) {
                // Use first language and warn if multiple detected
                language = mostMatchedLanguages[0];
                if (mostMatchedLanguages.length > 1) {
                    console.warn("Multiple possible languages");
                    console.warn(mostMatchedLanguages);
                }
            }
        }
        return language;
    }

    function getLanguageFromUrl() {
        for (var language in WORDLISTS) {
            if (window.location.hash.indexOf(language) > -1) {
                return language;
            }
        }
        return "";
    }

    function setMnemonicLanguage() {
        var language = getLanguage();
        // Load the bip39 mnemonic generator for this language if required
        if (!(language in mnemonics)) {
            mnemonics[language] = new Mnemonic(language);
        }
        mnemonic = mnemonics[language];
    }

    function convertPhraseToNewLanguage() {
        var oldLanguage = getLanguageFromPhrase();
        var newLanguage = getLanguageFromUrl();
        var oldPhrase = DOM.phrase.val();
        var oldWords = phraseToWordArray(oldPhrase);
        var newWords = [];
        for (var i=0; i<oldWords.length; i++) {
            var oldWord = oldWords[i];
            var index = WORDLISTS[oldLanguage].indexOf(oldWord);
            var newWord = WORDLISTS[newLanguage][index];
            newWords.push(newWord);
        }
        newPhrase = wordArrayToPhrase(newWords);
        return newPhrase;
    }

    // TODO look at jsbip39 - mnemonic.splitWords
    function phraseToWordArray(phrase) {
        var words = phrase.split(/\s/g);
        var noBlanks = [];
        for (var i=0; i<words.length; i++) {
            var word = words[i];
            if (word.length > 0) {
                noBlanks.push(word);
            }
        }
        return noBlanks;
    }

    // TODO look at jsbip39 - mnemonic.joinWords
    function wordArrayToPhrase(words) {
        var phrase = words.join(" ");
        var language = getLanguageFromPhrase(phrase);
        if (language == "japanese") {
            phrase = words.join("\u3000");
        }
        return phrase;
    }

    function writeSplitPhrase(phrase) {
        var wordCount = phrase.split(/\s/g).length;
        var left=[];
        for (var i=0;i<wordCount;i++) left.push(i);
        var group=[[],[],[]],
            groupI=-1;
        var seed = Math.abs(sjcl.hash.sha256.hash(phrase)[0])% 2147483647;
        while (left.length>0) {
            groupI=(groupI+1)%3;
            seed = seed * 16807 % 2147483647;
            var selected=Math.floor(left.length*(seed - 1) / 2147483646);
            group[groupI].push(left[selected]);
            left.splice(selected,1);
        }
        var cards=[phrase.split(/\s/g),phrase.split(/\s/g),phrase.split(/\s/g)];
        for (var i=0;i<3;i++) {
            for (var ii=0;ii<wordCount/3;ii++) cards[i][group[i][ii]]='XXXX';
            cards[i]='Card '+(i+1)+': '+wordArrayToPhrase(cards[i]);
        }
        DOM.phraseSplit.val(cards.join("\r\n"));
        var triesPerSecond=10000000000;
        var hackTime=Math.pow(2,wordCount*10/3)/triesPerSecond;
        var displayRedText = false;
        if (hackTime<1) {
            hackTime="<1 second";
            displayRedText = true;
        } else if (hackTime<86400) {
            hackTime=Math.floor(hackTime)+" seconds";
            displayRedText = true;
        } else if(hackTime<31557600) {
            hackTime=Math.floor(hackTime/86400)+" days";
            displayRedText = true;
        } else {
            hackTime=Math.floor(hackTime/31557600)+" years";
        }
        DOM.phraseSplitWarn.html("Time to hack with only one card: "+hackTime);
        if (displayRedText) {
            DOM.phraseSplitWarn.addClass("text-danger");
        } else {
            DOM.phraseSplitWarn.removeClass("text-danger");
        }
    }

    function isUsingOwnEntropy() {
        return DOM.useEntropy.prop("checked");
    }

    function setMnemonicFromEntropy() {
		console.log('setMnemonicFromEntropy ALC no string'); // MW 241209
        clearEntropyFeedback();
        // Get entropy value
        var entropyStr = DOM.entropy.val();
        // Work out minimum base for entropy
        var entropy = null;
        if (entropyTypeAutoDetect) {
            entropy = Entropy.fromString(entropyStr);
        }
        else {
            let base = DOM.entropyTypeInputs.filter(":checked").val();
            entropy = Entropy.fromString(entropyStr, base);
        }
        if (entropy.binaryStr.length == 0) {
            return;
        }
        // Show entropy details
        showEntropyFeedback(entropy);
        // Use entropy hash if not using raw entropy
        var bits = entropy.binaryStr;
        //var mnemonicLength = DOM.entropyMnemonicLength.val();
		/* console.log('mnemonicLength',mnemonicLength);*/
		var mnemonicLength = "raw";
        if (mnemonicLength != "raw") {
            // Get bits by hashing entropy with SHA256
            var hash = sjcl.hash.sha256.hash(entropy.cleanStr);
            var hex = sjcl.codec.hex.fromBits(hash);
            bits = libs.BigInteger.BigInteger.parse(hex, 16).toString(2);
            while (bits.length % 256 != 0) {
                bits = "0" + bits;
            }
            // Truncate hash to suit number of words
            mnemonicLength = parseInt(mnemonicLength);
            var numberOfBits = 32 * mnemonicLength / 3;
            bits = bits.substring(0, numberOfBits);
            // show warning for weak entropy override
            if (mnemonicLength / 3 * 32 > entropy.binaryStr.length) {
                DOM.entropyWeakEntropyOverrideWarning.removeClass("hidden");
            }
            else {
                DOM.entropyWeakEntropyOverrideWarning.addClass("hidden");
            }
        }
        else {
            // hide warning for weak entropy override
            DOM.entropyWeakEntropyOverrideWarning.addClass("hidden");
        }
        // Discard trailing entropy
        var bitsToUse = Math.floor(bits.length / 32) * 32;
        var start = bits.length - bitsToUse;
        var binaryStr = bits.substring(start);
        // Convert entropy string to numeric array
        var entropyArr = [];
        for (var i=0; i<binaryStr.length / 8; i++) {
            var byteAsBits = binaryStr.substring(i*8, i*8+8);
            var entropyByte = parseInt(byteAsBits, 2);
            entropyArr.push(entropyByte)
        }
        // Convert entropy array to mnemonic
		var phrase = mnemonic.toMnemonic(entropyArr);
        // Set the mnemonic in the UI
		if (!phraseM.startsWith("XMR")) {
		  DOM.phraseM.val(phraseM);
		  set_phraseM = true;
		}
        DOM.phrase.val(phrase);
        writeSplitPhrase(phrase);
        // Show the word indexes
        showWordIndexes();
        // Show the checksum
        showChecksum();
    }

    function clearEntropyFeedback() {
        DOM.entropyCrackTime.text("...");
        DOM.entropyType.text("");
        DOM.entropyWordCount.text("0");
        DOM.entropyEventCount.text("0");
        DOM.entropyBitsPerEvent.text("0");
        DOM.entropyBits.text("0");
        DOM.entropyFiltered.html("&nbsp;");
        DOM.entropyBinary.html("&nbsp;");
		DOM.xmrpublic.html("&nbsp;");
		DOM.xmrprivate.html("&nbsp;");
		DOM.xmrprivateview.html("&nbsp;");
		DOM.xmrpublicview.html("&nbsp;");
    }

    function showEntropyFeedback(entropy) {
        var numberOfBits = entropy.binaryStr.length;
        var timeToCrack = "unknown";
        try {
            var z = libs.zxcvbn(entropy.base.events.join(""));
            timeToCrack = z.crack_times_display.offline_fast_hashing_1e10_per_second;
            if (z.feedback.warning != "") {
                timeToCrack = timeToCrack + " - " + z.feedback.warning;
            };
        }
        catch (e) {
            console.log("Error detecting entropy strength with zxcvbn:");
            console.log(e);
        }
        var entropyTypeStr = getEntropyTypeStr(entropy);
        DOM.entropyTypeInputs.attr("checked", false);
        DOM.entropyTypeInputs.filter("[value='" + entropyTypeStr + "']").attr("checked", true);
        var wordCount = Math.floor(numberOfBits / 32) * 3;
        var bitsPerEvent = entropy.bitsPerEvent.toFixed(2);
        var spacedBinaryStr = addSpacesEveryElevenBits(entropy.binaryStr);
        DOM.entropyFiltered.html(entropy.cleanHtml);
		DOM.xmrpublic.html(alc_xmrpublickey);
		DOM.xmrprivate.html(alc_xmrprivatekey);
		DOM.xmrprivateview.html(alc_xmrprivateview);
		DOM.xmrpublicview.html(alc_xmrpublicview);
        DOM.entropyType.text(entropyTypeStr);
        DOM.entropyCrackTime.text(timeToCrack);
        DOM.entropyEventCount.text(entropy.base.events.length);
        DOM.entropyBits.text(numberOfBits);
        DOM.entropyWordCount.text(wordCount);
        DOM.entropyBinary.text(spacedBinaryStr);
        DOM.entropyBitsPerEvent.text(bitsPerEvent);
        // detect and warn of filtering
        var rawNoSpaces = DOM.entropy.val().replace(/\s/g, "");
        var cleanNoSpaces = entropy.cleanStr.replace(/\s/g, "");
        var isFiltered = rawNoSpaces.length != cleanNoSpaces.length;
        if (isFiltered) {
            DOM.entropyFilterWarning.removeClass('hidden');
        }
        else {
            DOM.entropyFilterWarning.addClass('hidden');
        }
    }

    function getEntropyTypeStr(entropy) {
        var typeStr = entropy.base.str;
        // Add some detail if these are cards
        if (entropy.base.asInt == 52) {
            var cardDetail = []; // array of message strings
            // Detect duplicates
            var dupes = [];
            var dupeTracker = {};
            for (var i=0; i<entropy.base.events.length; i++) {
                var card = entropy.base.events[i];
                var cardUpper = card.toUpperCase();
                if (cardUpper in dupeTracker) {
                    dupes.push(card);
                }
                dupeTracker[cardUpper] = true;
            }
            if (dupes.length > 0) {
                var dupeWord = "duplicates";
                if (dupes.length == 1) {
                    dupeWord = "duplicate";
                }
                var msg = dupes.length + " " + dupeWord + ": " + dupes.slice(0,3).join(" ");
                if (dupes.length > 3) {
                    msg += "...";
                }
                cardDetail.push(msg);
            }
            // Detect full deck
            var uniqueCards = [];
            for (var uniqueCard in dupeTracker) {
                uniqueCards.push(uniqueCard);
            }
            if (uniqueCards.length == 52) {
                cardDetail.unshift("full deck");
            }
            // Detect missing cards
            var values = "A23456789TJQK";
            var suits = "CDHS";
            var missingCards = [];
            for (var i=0; i<suits.length; i++) {
                for (var j=0; j<values.length; j++) {
                    var card = values[j] + suits[i];
                    if (!(card in dupeTracker)) {
                        missingCards.push(card);
                    }
                }
            }
            // Display missing cards if six or less, ie clearly going for full deck
            if (missingCards.length > 0 && missingCards.length <= 6) {
                var msg = missingCards.length + " missing: " + missingCards.slice(0,3).join(" ");
                if (missingCards.length > 3) {
                    msg += "...";
                }
                cardDetail.push(msg);
            }
            // Add card details to typeStr
            if (cardDetail.length > 0) {
                typeStr += " (" + cardDetail.join(", ") + ")";
            }
        }
        return typeStr;
    }

    function setQrEvents(els) {
        els.on("mouseenter", createQr);
        els.on("mouseleave", destroyQr);
        els.on("click", toggleQr);
    }

    function createQr(e) {
        var content = e.target.textContent || e.target.value;
        if (content) {
            var qrEl = libs.kjua({
                text: content,
                render: "canvas",
                size: 310,
                ecLevel: 'H',
            });
            DOM.qrImage.append(qrEl);
            if (!showQr) {
                DOM.qrHider.addClass("hidden");
            }
            else {
                DOM.qrHider.removeClass("hidden");
            }
            DOM.qrContainer.removeClass("hidden");
        }
    }

    function destroyQr() {
        DOM.qrImage.text("");
        DOM.qrContainer.addClass("hidden");
    }

    function toggleQr() {
        showQr = !showQr;
        DOM.qrHider.toggleClass("hidden");
        DOM.qrHint.toggleClass("hidden");
    }

    function bip44TabSelected() {
        return DOM.bip44tab.hasClass("active");
    }

    function bip32TabSelected() {
        return DOM.bip32tab.hasClass("active");
    }

    function networkIsEthereum() {
        var name = networks[DOM.network.val()].name;
        return (name == "ETH - Ethereum")
                    || (name == "ETC - Ethereum Classic")
                    || (name == "EWT - EnergyWeb")
                    || (name == "PIRL - Pirl")
                    || (name == "MIX - MIX")
                    || (name == "MOAC - MOAC")
                    || (name == "MUSIC - Musicoin")
                    || (name == "POA - Poa")
                    || (name == "EXP - Expanse")
                    || (name == "CLO - Callisto")
                    || (name == "DXN - DEXON")
                    || (name == "ELLA - Ellaism")
                    || (name == "ESN - Ethersocial Network")
                    || (name == "VET - VeChain")
                    || (name == "ERE - EtherCore")
                    || (name == "BSC - Binance Smart Chain")
    }

    function networkIsRsk() {
        var name = networks[DOM.network.val()].name;
        return (name == "R-BTC - RSK")
            || (name == "tR-BTC - RSK Testnet");
    }

    function networkHasSegwit() {
        var n = network;
        if ("baseNetwork" in network) {
            n = libs.bitcoin.networks[network.baseNetwork];
        }
        // check if only p2wpkh params are required
        if (p2wpkhSelected()) {
            return "p2wpkh" in n;
        }
        // check if only p2wpkh-in-p2sh params are required
        else if (p2wpkhInP2shSelected()) {
            return "p2wpkhInP2sh" in n;
        }
        // require both if it's unclear which params are required
        return "p2wpkh" in n && "p2wpkhInP2sh" in n;
    }

    function bip49TabSelected() {
        return DOM.bip49tab.hasClass("active");
    }

    function bip84TabSelected() {
        return DOM.bip84tab.hasClass("active");
    }

    function bip141TabSelected() {
        return DOM.bip141tab.hasClass("active");
    }

    function setHdCoin(coinValue) {
        DOM.bip44coin.val(coinValue);
        DOM.bip49coin.val(coinValue);
        DOM.bip84coin.val(coinValue);
    }

    function showSegwitAvailable() {
        DOM.bip49unavailable.addClass("hidden");
        DOM.bip49available.removeClass("hidden");
        DOM.bip84unavailable.addClass("hidden");
        DOM.bip84available.removeClass("hidden");
        DOM.bip141unavailable.addClass("hidden");
        DOM.bip141available.removeClass("hidden");
    }

    function showSegwitUnavailable() {
        DOM.bip49available.addClass("hidden");
        DOM.bip49unavailable.removeClass("hidden");
        DOM.bip84available.addClass("hidden");
        DOM.bip84unavailable.removeClass("hidden");
        DOM.bip141available.addClass("hidden");
        DOM.bip141unavailable.removeClass("hidden");
    }

    function adjustNetworkForSegwit() {
        // If segwit is selected the xpub/xprv prefixes need to be adjusted
        // to avoid accidentally importing BIP49 xpub to BIP44 watch only
        // wallet.
        // See https://github.com/iancoleman/bip39/issues/125
        var segwitNetworks = null;
        // if a segwit network is alread selected, need to use base network to
        // look up new parameters
        if ("baseNetwork" in network) {
            network = libs.bitcoin.networks[network.baseNetwork];
        }
        // choose the right segwit params
        if (p2wpkhSelected() && "p2wpkh" in network) {
            network = network.p2wpkh;
        }
        else if (p2wpkhInP2shSelected() && "p2wpkhInP2sh" in network) {
            network = network.p2wpkhInP2sh;
        }
        else if (p2wshSelected() && "p2wsh" in network) {
            network = network.p2wsh;
        }
        else if (p2wshInP2shSelected() && "p2wshInP2sh" in network) {
            network = network.p2wshInP2sh;
        }
    }

    function lastIndexInTable() {
        var pathText = DOM.addresses.find(".index").last().text();
        var pathBits = pathText.split("/");
        var lastBit = pathBits[pathBits.length-1];
        var lastBitClean = lastBit.replace("'", "");
        return parseInt(lastBitClean);
    }

    function uint8ArrayToHex(a) {
        var s = ""
        for (var i=0; i<a.length; i++) {
            var h = a[i].toString(16);
            while (h.length < 2) {
                h = "0" + h;
            }
            s = s + h;
        }
        return s;
    }

    function showWordIndexes() {
        var phrase = DOM.phrase.val();
        var words = phraseToWordArray(phrase);
        var wordIndexes = [];
        var language = getLanguage();
        for (var i=0; i<words.length; i++) {
            var word = words[i];
            var wordIndex = WORDLISTS[language].indexOf(word);
            wordIndexes.push(wordIndex);
        }
        var wordIndexesStr = wordIndexes.join(", ");
        DOM.entropyWordIndexes.text(wordIndexesStr);
    }

    function showChecksum() {
        var phrase = DOM.phrase.val();
        var words = phraseToWordArray(phrase);
        var checksumBitlength = words.length / 3;
        var checksum = "";
        var binaryStr = "";
        var language = getLanguage();
        for (var i=words.length-1; i>=0; i--) {
            var word = words[i];
            var wordIndex = WORDLISTS[language].indexOf(word);
            var wordBinary = wordIndex.toString(2);
            while (wordBinary.length < 11) {
                wordBinary = "0" + wordBinary;
            }
            var binaryStr = wordBinary + binaryStr;
            if (binaryStr.length >= checksumBitlength) {
                var start = binaryStr.length - checksumBitlength;
                var end = binaryStr.length;
                checksum = binaryStr.substring(start, end);
                // add spaces so the last group is 11 bits, not the first
                checksum = checksum.split("").reverse().join("")
                checksum = addSpacesEveryElevenBits(checksum);
                checksum = checksum.split("").reverse().join("")
                break;
            }
        }
        DOM.entropyChecksum.text(checksum);
    }

    function updateCsv() {
        var tableCsv = "path,address,public key,private key\n";
        var rows = DOM.addresses.find("tr");
        for (var i=0; i<rows.length; i++) {
            var row = $(rows[i]);
            var cells = row.find("td");
            for (var j=0; j<cells.length; j++) {
                var cell = $(cells[j]);
                if (!cell.children().hasClass("invisible")) {
                    tableCsv = tableCsv + cell.text();
                }
                if (j != cells.length - 1) {
                    tableCsv = tableCsv + ",";
                }
            }
            tableCsv = tableCsv + "\n";
        }
        DOM.csv.val(tableCsv);
    }

    function addSpacesEveryElevenBits(binaryStr) {
        return binaryStr.match(/.{1,11}/g).join(" ");
    }

    var networks = [
        /*{
            name: "AC - Asiacoin",
            onSelect: function() {
                network = libs.bitcoin.networks.asiacoin;
                setHdCoin(51);
            },
        },*/
        /*{
            name: "ACC - Adcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.adcoin;
                setHdCoin(161);
            },
        },*/
        /*{
            name: "AGM - Argoneum",
            onSelect: function() {
                network = libs.bitcoin.networks.argoneum;
                setHdCoin(421);
            },
        },*/
        /*{
            name: "ARYA - Aryacoin",
            onSelect: function() {
                network = libs.bitcoin.networks.aryacoin;
                setHdCoin(357);
            },
        },*/
        /* MW 250329 {
            name: "ATOM - Cosmos Hub",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(118);
            },
        },*/
        /*{
            name: "AUR - Auroracoin",
            onSelect: function() {
                network = libs.bitcoin.networks.auroracoin;
                setHdCoin(85);
            },
        },*/
        /*{
            name: "AXE - Axe",
            onSelect: function() {
                network = libs.bitcoin.networks.axe;
                setHdCoin(4242);
            },
        },*/
        /*{
            name: "ANON - ANON",
            onSelect: function() {
                network = libs.bitcoin.networks.anon;
                setHdCoin(220);
            },
        },*/
        /*{
            name: "BOLI - Bolivarcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.bolivarcoin;
                setHdCoin(278);
            },
        },*/
        /* MW 250329 {
            name: "BCA - Bitcoin Atom",
            onSelect: function() {
                network = libs.bitcoin.networks.atom;
                setHdCoin(185);
            },
        },*/
        {
            name: "BCH - Bitcoin Cash",
            onSelect: function() {
                DOM.bitcoinCashAddressTypeContainer.removeClass("hidden");
                setHdCoin(145);
            },
        },
        /*{
            name: "BEET - Beetlecoin",
            onSelect: function() {
                network = libs.bitcoin.networks.beetlecoin;
                setHdCoin(800);
            },
        },*/
        /*{
            name: "BELA - Belacoin",
            onSelect: function() {
                network = libs.bitcoin.networks.belacoin;
                setHdCoin(73);
            },
        },*/
        /* MW 250329 {
            name: "BLK - BlackCoin",
            onSelect: function() {
                network = libs.bitcoin.networks.blackcoin;
                setHdCoin(10);
            },
        },*/
        /*{
            name: "BND - Blocknode",
            onSelect: function() {
                network = libs.bitcoin.networks.blocknode;
                setHdCoin(2941);
            },
        },*/
        /*{
            name: "tBND - Blocknode Testnet",
            onSelect: function() {
                network = libs.bitcoin.networks.blocknode_testnet;
                setHdCoin(1);
            },
        },*/
        /*{
            name: "BRIT - Britcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.britcoin;
                setHdCoin(70);
            },
        },*/
        /*{
            name: "BSD - Bitsend",
            onSelect: function() {
                network = libs.bitcoin.networks.bitsend;
                setHdCoin(91);
            },
        },*/
        /*{
            name: "BST - BlockStamp",
            onSelect: function() {
                network = libs.bitcoin.networks.blockstamp;
                setHdCoin(254);
            },
        },*/
        /*{
            name: "BTA - Bata",
            onSelect: function() {
                network = libs.bitcoin.networks.bata;
                setHdCoin(89);
            },
        },*/
        {
            name: "BTC - Bitcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(0);
            },
        },
        /*{
            name: "BTC - Bitcoin RegTest",
            onSelect: function() {
                network = libs.bitcoin.networks.regtest;
                // Using hd coin value 1 based on bip44_coin_type
                // https://github.com/chaintope/bitcoinrb/blob/f1014406f6b8f9b4edcecedc18df70c80df06f11/lib/bitcoin/chainparams/regtest.yml
                setHdCoin(1);
            },
        },*/
        /*{
            name: "BTC - Bitcoin Testnet",
            onSelect: function() {
                network = libs.bitcoin.networks.testnet;
                setHdCoin(1);
            },
        },*/
        /* MW 250329 {
            name: "BITG - Bitcoin Green",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoingreen;
                setHdCoin(222);
            },
        },*/
        /* MW 250329 {
            name: "BTCP - Bitcoin Private",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoinprivate;
                setHdCoin(183);
            },
        },*/
        /*{
            name: "BTCPt - Bitcoin Private Testnet",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoinprivatetestnet;
                setHdCoin(1);
            },
        },*/
        /* MW 250329 {
            name: "BSC - Binance Smart Chain",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(60);
            },
        },*/
        /* MW 250329 {
            name: "BSV - BitcoinSV",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoinsv;
                setHdCoin(236);
            },
        },*/
        /*{
            name: "BTCZ - Bitcoinz",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoinz;
                setHdCoin(177);
            },
        },*/
        /*{
            name: "BTDX - BitCloud",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcloud;
                setHdCoin(218);
            },
        },*/
        /* MW 250329 {
            name: "BTG - Bitcoin Gold",
            onSelect: function() {
                network = libs.bitcoin.networks.bgold;
                setHdCoin(156);
            },
        },*/
        /* MW 250329 {
            name: "BTX - Bitcore",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcore;
                setHdCoin(160);
            },
        },*/
        /*{
            name: "CCN - Cannacoin",
            onSelect: function() {
                network = libs.bitcoin.networks.cannacoin;
                setHdCoin(19);
            },
        },*/
        /*{
            name: "CESC - Cryptoescudo",
            onSelect: function() {
                network = libs.bitcoin.networks.cannacoin;
                setHdCoin(111);
            },
        },*/
        /*{
            name: "CDN - Canadaecoin",
            onSelect: function() {
                network = libs.bitcoin.networks.canadaecoin;
                setHdCoin(34);
            },
        },*/
        /*{
            name: "CLAM - Clams",
            onSelect: function() {
                network = libs.bitcoin.networks.clam;
                setHdCoin(23);
            },
        },*/
        /*{
            name: "CLO - Callisto",
            segwitAvailable: false,
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(820);
            },
        },*/
        /*{
            name: "CLUB - Clubcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.clubcoin;
                setHdCoin(79);
            },
        },*/
        /*{
            name: "CMP - Compcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.compcoin;
                setHdCoin(71);
            },
        },*/
        /* MW 250329 {
            name: "CPU - CPUchain",
            onSelect: function() {
                network = libs.bitcoin.networks.cpuchain;
                setHdCoin(363);
            },
        },*/
        /*{
            name: "CRAVE - Crave",
            onSelect: function() {
                network = libs.bitcoin.networks.crave;
                setHdCoin(186);
            },
        },*/
        /*{
            name: "CRP - CranePay",
            onSelect: function() {
                network = libs.bitcoin.networks.cranepay;
                setHdCoin(2304);
            },
        },*/

        /*{
            name: "CRW - Crown (Legacy)",
            onSelect: function() {
                network = libs.bitcoin.networks.crown;
                setHdCoin(72);
            },
        },*/
        /*{
            name: "CRW - Crown",
            onSelect: function() {
                network = libs.bitcoin.networks.crown;
                setHdCoin(72);
            },
        },*/
        /*{
            name: "CSC - CasinoCoin",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(359);
            },
        },*/
        /* MW 250329 {
            name: "DASH - Dash",
            onSelect: function() {
                network = libs.bitcoin.networks.dash;
                setHdCoin(5);
            },
        },*/
        /*{
            name: "DASH - Dash Testnet",
            onSelect: function() {
                network = libs.bitcoin.networks.dashtn;
                setHdCoin(1);
            },
        },*/
        /*{
            name: "DFC - Defcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.defcoin;
                setHdCoin(1337);
            },
        },*/
        /*{
            name: "DGB - Digibyte",
            onSelect: function() {
                network = libs.bitcoin.networks.digibyte;
                setHdCoin(20);
            },
        },*/
        /*{
            name: "DGC - Digitalcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.digitalcoin;
                setHdCoin(18);
            },
        },*/
        /*{
            name: "DIVI - DIVI",
            onSelect: function() {
                network = libs.bitcoin.networks.divi;
                setHdCoin(301);
            },
        },*/
        /*{
            name: "DIVI - DIVI Testnet",
            onSelect: function() {
                network = libs.bitcoin.networks.divitestnet;
                setHdCoin(1);
            },
        },*/
        /* MW 250329 {
            name: "DMD - Diamond",
            onSelect: function() {
                network = libs.bitcoin.networks.diamond;
                setHdCoin(152);
            },
        },*/
        /*{
            name: "DNR - Denarius",
            onSelect: function() {
                network = libs.bitcoin.networks.denarius;
                setHdCoin(116);
            },
        },*/
        {
            name: "DOGE - Dogecoin",
            onSelect: function() {
                network = libs.bitcoin.networks.dogecoin;
                setHdCoin(3);
            },
        },
        /*{
            name: "DOGEt - Dogecoin Testnet",
            onSelect: function() {
                network = libs.bitcoin.networks.dogecointestnet;
                setHdCoin(1);
            },
        },*/
        /*{
            name: "DXN - DEXON",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(237);
            },
        },*/
        /*{
            name: "ECN - Ecoin",
            onSelect: function() {
                network = libs.bitcoin.networks.ecoin;
                setHdCoin(115);
            },
        },*/
        /*{
            name: "EDRC - Edrcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.edrcoin;
                setHdCoin(56);
            },
        },*/
        /*{
            name: "EFL - Egulden",
            onSelect: function() {
                network = libs.bitcoin.networks.egulden;
                setHdCoin(78);
            },
        },*/
        /* MW 250329 {
            name: "ELA - Elastos",
            onSelect: function () {
                network = libs.bitcoin.networks.elastos;
                setHdCoin(2305);
            },
        },*/
        /*{
            name: "ELLA - Ellaism",
            segwitAvailable: false,
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(163);
            },
        },*/
        /*{
            name: "EMC2 - Einsteinium",
            onSelect: function() {
                network = libs.bitcoin.networks.einsteinium;
                setHdCoin(41);
            },
        },*/
        /*{
            name: "ERC - Europecoin",
            onSelect: function() {
                network = libs.bitcoin.networks.europecoin;
                setHdCoin(151);
            },
        },*/
        /* MW 250329 {
            name: "EOS - EOSIO",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(194);
            },
        },*/
        /*{
            name: "ERE - EtherCore",
            segwitAvailable: false,
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(466);
            },
        },*/
        /*{
            name: "ESN - Ethersocial Network",
            segwitAvailable: false,
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(31102);
            },
        },*/
        {
            name: "ETC - Ethereum Classic",
            segwitAvailable: false,
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(61);
            },
        },
        {
            name: "ETH - Ethereum",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(60);
            },
          },
        /* MW 250329 {
            name: "EWT - EnergyWeb",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(246);
            },
          },*/
        /*{
            name: "EXCL - Exclusivecoin",
            onSelect: function() {
                network = libs.bitcoin.networks.exclusivecoin;
                setHdCoin(190);
            },
        },*/
        /*{
            name: "EXCC - ExchangeCoin",
            onSelect: function() {
                network = libs.bitcoin.networks.exchangecoin;
                setHdCoin(0);
            },
        },*/
        /*{
            name: "EXP - Expanse",
            segwitAvailable: false,
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(40);
            },
        },*/
        /*{
            name: "FIO - Foundation for Interwallet Operability",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(235);
            },
        },*/
        /* MW 250329 {
            name: "FIRO - Firo (Zcoin rebrand)",
            onSelect: function() {
                network = libs.bitcoin.networks.firo;
                setHdCoin(136);
            },
        },*/
        /*{
            name: "FIX - FIX",
            onSelect: function() {
                network = libs.bitcoin.networks.fix;
                setHdCoin(336);
            },
        },*/
        /*{
            name: "FIX - FIX Testnet",
            onSelect: function() {
                network = libs.bitcoin.networks.fixtestnet;
                setHdCoin(1);
            },
        },*/
        /*{
            name: "FJC - Fujicoin",
            onSelect: function() {
                network = libs.bitcoin.networks.fujicoin;
                setHdCoin(75);
            },
        },*/
        /*{
            name: "FLASH - Flashcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.flashcoin;
                setHdCoin(120);
            },
        },*/
        /*{
            name: "FRST - Firstcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.firstcoin;
                setHdCoin(167);
            },
        },*/
        /*{
            name: "FTC - Feathercoin",
            onSelect: function() {
                network = libs.bitcoin.networks.feathercoin;
                setHdCoin(8);
            },
        },*/
        /*{
            name: "GAME - GameCredits",
            onSelect: function() {
                network = libs.bitcoin.networks.game;
                setHdCoin(101);
            },
        },*/
        /*{
            name: "GBX - Gobyte",
            onSelect: function() {
                network = libs.bitcoin.networks.gobyte;
                setHdCoin(176);
            },
        },*/
        /*{
            name: "GCR - GCRCoin",
            onSelect: function() {
                network = libs.bitcoin.networks.gcr;
                setHdCoin(79);
            },
        },*/
        /*{
            name: "GRC - Gridcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.gridcoin;
                setHdCoin(84);
            },
        },*/
        /*{
            name: "GRS - Groestlcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.groestlcoin;
                setHdCoin(17);
            },
        },*/
        /*{
            name: "GRS - Groestlcoin Testnet",
            onSelect: function() {
                network = libs.bitcoin.networks.groestlcointestnet;
                setHdCoin(1);
            },
        },*/
        /*{
            name: "HNS - Handshake",
            onSelect: function() {
                setHdCoin(5353);
            },
        },*/
        /*{
            name: "HNC - Helleniccoin",
            onSelect: function() {
                network = libs.bitcoin.networks.helleniccoin;
                setHdCoin(168);
            },
        },*/
        /*{
            name: "HUSH - Hush (Legacy)",
            onSelect: function() {
                network = libs.bitcoin.networks.hush;
                setHdCoin(197);
            },
        },*/
        /*{
            name: "HUSH - Hush3",
            onSelect: function() {
                network = libs.bitcoin.networks.hush3;
                setHdCoin(197);
            },
        },*/
        /*{
            name: "INSN - Insane",
            onSelect: function() {
                network = libs.bitcoin.networks.insane;
                setHdCoin(68);
            },
        },*/
        /*{
            name: "IOP - Iop",
            onSelect: function() {
                network = libs.bitcoin.networks.iop;
                setHdCoin(66);
            },
        },*/
        /*{
            name: "IOV - Starname",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(234);
            },
         },*/
         /*{
            name: "IXC - Ixcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.ixcoin;
                setHdCoin(86);
            },
        },*/
        /*{
            name: "JBS - Jumbucks",
            onSelect: function() {
                network = libs.bitcoin.networks.jumbucks;
                setHdCoin(26);
            },
        },*/
        /* MW 250329 {
            name: "KMD - Komodo",
            bip49available: false,
            onSelect: function() {
                network = libs.bitcoin.networks.komodo;
                setHdCoin(141);
            },
        },*/
        /*{
            name: "KOBO - Kobocoin",
            bip49available: false,
            onSelect: function() {
                network = libs.bitcoin.networks.kobocoin;
                setHdCoin(196);
            },
        },*/
        /*{
            name: "LBC - Library Credits",
            onSelect: function() {
                network = libs.bitcoin.networks.lbry;
                setHdCoin(140);
            },
        },*/
        /* MW 250329 {
            name: "LCC - Litecoincash",
            onSelect: function() {
                network = libs.bitcoin.networks.litecoincash;
                setHdCoin(192);
            },
        },*/
        /*{
            name: "LDCN - Landcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.landcoin;
                setHdCoin(63);
            },
        },*/
        /*{
            name: "LINX - Linx",
            onSelect: function() {
                network = libs.bitcoin.networks.linx;
                setHdCoin(114);
            },
        },*/
        /*{
            name: "LKR - Lkrcoin",
            segwitAvailable: false,
            onSelect: function() {
                network = libs.bitcoin.networks.lkrcoin;
                setHdCoin(557);
            },
        },*/
        {
            name: "LTC - Litecoin",
            onSelect: function() {
                network = libs.bitcoin.networks.litecoin;
                setHdCoin(2);
                DOM.litecoinLtubContainer.removeClass("hidden");
            },
        },
        /*{
            name: "LTCt - Litecoin Testnet",
            onSelect: function() {
                network = libs.bitcoin.networks.litecointestnet;
                setHdCoin(1);
                DOM.litecoinLtubContainer.removeClass("hidden");
            },
        },*/
        /*{
            name: "LTZ - LitecoinZ",
            onSelect: function() {
                network = libs.bitcoin.networks.litecoinz;
                setHdCoin(221);
            },
        },*/
        {
            name: "LUNA - Terra",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(330);
            },
        },
        /*{
            name: "LYNX - Lynx",
            onSelect: function() {
                network = libs.bitcoin.networks.lynx;
                setHdCoin(191);
            },
        },*/
        /*{
            name: "MAZA - Maza",
            onSelect: function() {
                network = libs.bitcoin.networks.maza;
                setHdCoin(13);
            },
        },*/
        /*{
            name: "MEC - Megacoin",
            onSelect: function() {
                network = libs.bitcoin.networks.megacoin;
                setHdCoin(217);
            },
        },*/
        /*{
            name: "MIX - MIX",
            segwitAvailable: false,
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(76);
            },
        },*/
        /*{
            name: "MNX - Minexcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.minexcoin;
                setHdCoin(182);
            },
        },*/
        /*{
            name: "MONA - Monacoin",
            onSelect: function() {
                network = libs.bitcoin.networks.monacoin,
                setHdCoin(22);
            },
        },*/
        /*{
            name: "MONK - Monkey Project",
            onSelect: function() {
                network = libs.bitcoin.networks.monkeyproject,
                setHdCoin(214);
            },
        },*/
        /*{
            name: "MOAC - MOAC",
            segwitAvailable: false,
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(314);
            },
        },*/
        /*{
            name: "MUSIC - Musicoin",
            segwitAvailable: false,
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(184);
            },
        },*/
        /*{
            name: "NANO - Nano",
            onSelect: function() {
                network = network = libs.nanoUtil.dummyNetwork;
                setHdCoin(165);
            },
        },*/
        /*{
            name: "NAV - Navcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.navcoin;
                setHdCoin(130);
            },
        },*/
        /*{
            name: "NAS - Nebulas",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(2718);
            },
        },*/
        /*{
            name: "NEBL - Neblio",
            onSelect: function() {
                network = libs.bitcoin.networks.neblio;
                setHdCoin(146);
            },
        },*/
        /*{
            name: "NEOS - Neoscoin",
            onSelect: function() {
                network = libs.bitcoin.networks.neoscoin;
                setHdCoin(25);
            },
        },*/
        /*{
            name: "NIX - NIX Platform",
            onSelect: function() {
                network = libs.bitcoin.networks.nix;
                setHdCoin(400);
            },
        },*/
        /*{
            name: "NLG - Gulden",
            onSelect: function() {
                network = libs.bitcoin.networks.gulden;
                setHdCoin(87);
            },
        },*/
        /*{
            name: "NMC - Namecoin",
            onSelect: function() {
                network = libs.bitcoin.networks.namecoin;
                setHdCoin(7);
            },
        },*/
        /*{
            name: "NRG - Energi",
            onSelect: function() {
                network = libs.bitcoin.networks.energi;
                setHdCoin(204);
            },
        },*/
        /*{
            name: "NRO - Neurocoin",
            onSelect: function() {
                network = libs.bitcoin.networks.neurocoin;
                setHdCoin(110);
            },
        },*/
        /*{
            name: "NSR - Nushares",
            onSelect: function() {
                network = libs.bitcoin.networks.nushares;
                setHdCoin(11);
            },
        },*/
        /*{
            name: "NYC - Newyorkc",
            onSelect: function() {
                network = libs.bitcoin.networks.newyorkc;
                setHdCoin(179);
            },
        },*/
        /*{
            name: "NVC - Novacoin",
            onSelect: function() {
                network = libs.bitcoin.networks.novacoin;
                setHdCoin(50);
            },
        },*/
        /*{
            name: "OK - Okcash",
            onSelect: function() {
                network = libs.bitcoin.networks.okcash;
                setHdCoin(69);
            },
        },*/
        /*{
            name: "OMNI - Omnicore",
            onSelect: function() {
                network = libs.bitcoin.networks.omnicore;
                setHdCoin(200);
            },
        },*/
        /* MW 250329 {
            name: "ONION - DeepOnion",
            onSelect: function() {
                network = libs.bitcoin.networks.deeponion;
                setHdCoin(305);
            },
        },*/
        /*{
            name: "ONX - Onixcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.onixcoin;
                setHdCoin(174);
            },
        },*/
        /* MW 250329 {
            name: "PART - Particl",
            onSelect: function() {
                network = libs.bitcoin.networks.particl;
                setHdCoin(44);
            },
        },*/
        /*{
            name: "PHR - Phore",
            onSelect: function() {
                network = libs.bitcoin.networks.phore;
                setHdCoin(444);
            },
        },*/
        /*{
            name: "PINK - Pinkcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.pinkcoin;
                setHdCoin(117);
            },
        },*/
        /*{
            name: "PIRL - Pirl",
            segwitAvailable: false,
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(164);
            },
        },*/
        /* MW 250329 {
            name: "PIVX - PIVX",
            onSelect: function() {
                network = libs.bitcoin.networks.pivx;
                setHdCoin(119);
            },
        },*/
        /*{
            name: "PIVX - PIVX Testnet",
            onSelect: function() {
                network = libs.bitcoin.networks.pivxtestnet;
                setHdCoin(1);
            },
        },*/
        /*{
            name: "POA - Poa",
            segwitAvailable: false,
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(178);
            },
        },*/
        /*{
            name: "POSW - POSWcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.poswcoin;
                setHdCoin(47);
            },
        },*/
        /*{
            name: "POT - Potcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.potcoin;
                setHdCoin(81);
            },
        },*/
        /* MW 250329 {
            name: "PPC - Peercoin",
            onSelect: function() {
                network = libs.bitcoin.networks.peercoin;
                setHdCoin(6);
            },
        },*/
        /*{
            name: "PRJ - ProjectCoin",
            onSelect: function() {
                network = libs.bitcoin.networks.projectcoin;
                setHdCoin(533);
            },
        },*/
        /*{
            name: "PSB - Pesobit",
            onSelect: function() {
                network = libs.bitcoin.networks.pesobit;
                setHdCoin(62);
            },
        },*/
        /*{
            name: "PUT - Putincoin",
            onSelect: function() {
                network = libs.bitcoin.networks.putincoin;
                setHdCoin(122);
            },
        },*/
        /*{
            name: "RPD - Rapids",
            onSelect: function() {
                network = libs.bitcoin.networks.rapids;
                setHdCoin(320);
            },
        },*/
        /*{
            name: "RVN - Ravencoin",
            onSelect: function() {
                network = libs.bitcoin.networks.ravencoin;
                setHdCoin(175);
            },
        },*/
        /*{
            name: "R-BTC - RSK",
            onSelect: function() {
                network = libs.bitcoin.networks.rsk;
                setHdCoin(137);
            },
        },*/
        /*{
            name: "tR-BTC - RSK Testnet",
            onSelect: function() {
                network = libs.bitcoin.networks.rsktestnet;
                setHdCoin(37310);
            },
        },*/
        /*{
            name: "RBY - Rubycoin",
            onSelect: function() {
                network = libs.bitcoin.networks.rubycoin;
                setHdCoin(16);
            },
        },*/
        /*{
            name: "RDD - Reddcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.reddcoin;
                setHdCoin(4);
            },
        },*/
        /*{
            name: "RITO - Ritocoin",
            onSelect: function() {
                network = libs.bitcoin.networks.ritocoin;
                setHdCoin(19169);
            },
        },*/
        {
            name: "RUNE - THORChain",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(931);
            },
        },
        /*{
            name: "RVR - RevolutionVR",
            onSelect: function() {
                network = libs.bitcoin.networks.revolutionvr;
                setHdCoin(129);
            },
        },*/
        /*{
          name: "SAFE - Safecoin",
          onSelect: function() {
              network = libs.bitcoin.networks.safecoin;
              setHdCoin(19165);
            },
        },*/
        /*{
            name: "SCRIBE - Scribe",
            onSelect: function() {
                network = libs.bitcoin.networks.scribe;
                setHdCoin(545);
            },
        },*/
        /*{
          name: "SLS - Salus",
          onSelect: function() {
              network = libs.bitcoin.networks.salus;
              setHdCoin(63);
            },
        },*/
        /*{
            name: "SDC - ShadowCash",
            onSelect: function() {
                network = libs.bitcoin.networks.shadow;
                setHdCoin(35);
            },
        },*/
        /*{
            name: "SDC - ShadowCash Testnet",
            onSelect: function() {
                network = libs.bitcoin.networks.shadowtn;
                setHdCoin(1);
            },
        },*/
        /*{
            name: "SLM - Slimcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.slimcoin;
                setHdCoin(63);
            },
        },*/
        /*{
            name: "SLM - Slimcoin Testnet",
            onSelect: function() {
                network = libs.bitcoin.networks.slimcointn;
                setHdCoin(111);
            },
        },*/
        /*{
            name: "SLP - Simple Ledger Protocol",
            onSelect: function() {
                DOM.bitcoinCashAddressTypeContainer.removeClass("hidden");
                setHdCoin(245);
            },
        },*/
        /*{
            name: "SLR - Solarcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.solarcoin;
                setHdCoin(58);
            },
        },*/
        /*{
            name: "SMLY - Smileycoin",
            onSelect: function() {
                network = libs.bitcoin.networks.smileycoin;
                setHdCoin(59);
            },
        },*/
        /*{
            name: "STASH - Stash",
            onSelect: function() {
                network = libs.bitcoin.networks.stash;
                setHdCoin(0xC0C0);
            },
        },*/
        /*{
            name: "STASH - Stash Testnet",
            onSelect: function() {
                network = libs.bitcoin.networks.stashtn;
                setHdCoin(0xCAFE);
            },
        },*/
        /* MW 250329 {
            name: "STRAT - Stratis",
            onSelect: function() {
                network = libs.bitcoin.networks.stratis;
                setHdCoin(105);
            },
        },*/
        /*{
            name: "SUGAR - Sugarchain",
            onSelect: function() {
                network = libs.bitcoin.networks.sugarchain;
                setHdCoin(408);
            },
        },*/
        /*{
            name: "TUGAR - Sugarchain Testnet",
            onSelect: function() {
                network = libs.bitcoin.networks.sugarchaintestnet;
                setHdCoin(408);
            },
        },*/
        /*{
            name: "SWTC - Jingtum",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(315);
            },
        },*/
        /*{
            name: "TSTRAT - Stratis Testnet",
            onSelect: function() {
                network = libs.bitcoin.networks.stratistest;
                setHdCoin(105);
            },
        },*/
        /* MW 250329 {
            name: "SYS - Syscoin",
            onSelect: function() {
                network = libs.bitcoin.networks.syscoin;
                setHdCoin(57);
            },
        },*/
        /*{
            name: "THC - Hempcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.hempcoin;
                setHdCoin(113);
            },
        },*/
        /*{
            name: "THT - Thought",
            onSelect: function() {
                network = libs.bitcoin.networks.thought;
                setHdCoin(1618);
            },
        },*/
        /*{
            name: "TOA - Toa",
            onSelect: function() {
                network = libs.bitcoin.networks.toa;
                setHdCoin(159);
            },
        },*/
        {
            name: "TRX - Tron",
            onSelect: function() {
                setHdCoin(195);
            },
        },
        /*{
            name: "TWINS - TWINS",
            onSelect: function() {
                network = libs.bitcoin.networks.twins;
                setHdCoin(970);
            },
        },*/
        /*{
            name: "TWINS - TWINS Testnet",
            onSelect: function() {
                network = libs.bitcoin.networks.twinstestnet;
                setHdCoin(1);
            },
        },*/
        /*{
            name: "USC - Ultimatesecurecash",
            onSelect: function() {
                network = libs.bitcoin.networks.ultimatesecurecash;
                setHdCoin(112);
            },
        },*/
        /*{
            name: "USNBT - NuBits",
            onSelect: function() {
                network = libs.bitcoin.networks.nubits;
                setHdCoin(12);
            },
        },*/
        /*{
            name: "UNO - Unobtanium",
            onSelect: function() {
                network = libs.bitcoin.networks.unobtanium;
                setHdCoin(92);
            },
        },*/
        /*{
            name: "VASH - Vpncoin",
            onSelect: function() {
                network = libs.bitcoin.networks.vpncoin;
                setHdCoin(33);
            },
        },*/
        /*{
            name: "VET - VeChain",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(818);
            },
        },*/
        /*{
            name: "VIA - Viacoin",
            onSelect: function() {
                network = libs.bitcoin.networks.viacoin;
                setHdCoin(14);
            },
        },*/
        /*{
            name: "VIA - Viacoin Testnet",
            onSelect: function() {
                network = libs.bitcoin.networks.viacointestnet;
                setHdCoin(1);
            },
        },*/
        /*{
            name: "VIVO - Vivo",
            onSelect: function() {
                network = libs.bitcoin.networks.vivo;
                setHdCoin(166);
            },
        },*/
        /*{
            name: "VTC - Vertcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.vertcoin;
                setHdCoin(28);
            },
        },*/
        /*{
            name: "WGR - Wagerr",
            onSelect: function() {
                network = libs.bitcoin.networks.wagerr;
                setHdCoin(7825266);
            },
        },*/
        /*{
            name: "WC - Wincoin",
            onSelect: function() {
                network = libs.bitcoin.networks.wincoin;
                setHdCoin(181);
            },
        },*/
        /*{
            name: "XAX - Artax",
            onSelect: function() {
                network = libs.bitcoin.networks.artax;
                setHdCoin(219);
            },
        },*/
        /* MW 250329 {
            name: "XBC - Bitcoinplus",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoinplus;
                setHdCoin(65);
            },
        },*/
        /* MW 250329 {
            name: "XLM - Stellar",
            onSelect: function() {
                network = libs.stellarUtil.dummyNetwork;
                setHdCoin(148);
            },
        },*/
        {
            name: "XMR - Monero",
            onSelect: function() {
                network = libs.bitcoin.networks.monero;
                setHdCoin(128);
            },
        },
        /*{
            name: "XMY - Myriadcoin",
            onSelect: function() {
                network = libs.bitcoin.networks.myriadcoin;
                setHdCoin(90);
            },
        },*/
        {
            name: "XRP - Ripple",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(144);
            },
        },
        /*{
            name: "XVC - Vcash",
            onSelect: function() {
                network = libs.bitcoin.networks.vcash;
                setHdCoin(127);
            },
        },*/
        /*{
            name: "XVG - Verge",
            onSelect: function() {
                network = libs.bitcoin.networks.verge;
                setHdCoin(77);
            },
        },*/
        /*{
            name: "XUEZ - Xuez",
            segwitAvailable: false,
            onSelect: function() {
                network = libs.bitcoin.networks.xuez;
                setHdCoin(225);
            },
        },*/
        /*{
            name: "XWCC - Whitecoin Classic",
            onSelect: function() {
                network = libs.bitcoin.networks.whitecoin;
                setHdCoin(155);
            },
        },*/
        /*{
            name: "XZC - Zcoin (rebranded to Firo)",
            onSelect: function() {
                network = libs.bitcoin.networks.zcoin;
                setHdCoin(136);
            },
        },*/
        /*{
            name: "ZBC - ZooBlockchain",
            onSelect: function () {
            network = libs.bitcoin.networks.zoobc;
            setHdCoin(883);
            },
        },*/
        /*{
            name: "ZCL - Zclassic",
            onSelect: function() {
                network = libs.bitcoin.networks.zclassic;
                setHdCoin(147);
            },
        },*/
        {
            name: "ZEC - Zcash",
            onSelect: function() {
                network = libs.bitcoin.networks.zcash;
                setHdCoin(133);
            },
        },
        /* MW 250329 {
            name: "ZEN - Horizen",
            onSelect: function() {
                network = libs.bitcoin.networks.zencash;
                setHdCoin(121);
            },
        } */
        /*{
            name: "XWC - Whitecoin",
            onSelect: function() {
                network = libs.bitcoin.networks.bitcoin;
                setHdCoin(559);
            },
        }*/
    ]

    var clients = [
        {
            name: "Bitcoin Core",
            onSelect: function() {
                DOM.bip32path.val("m/0'/0'");
                DOM.hardenedAddresses.prop('checked', true);
            },
        },
        {
            name: "blockchain.info",
            onSelect: function() {
                DOM.bip32path.val("m/44'/0'/0'");
                DOM.hardenedAddresses.prop('checked', false);
            },
        },
        {
            name: "MultiBit HD",
            onSelect: function() {
                DOM.bip32path.val("m/0'/0");
                DOM.hardenedAddresses.prop('checked', false);
            },
        },
        {
            name: "Coinomi, Ledger",
            onSelect: function() {
                DOM.bip32path.val("m/44'/"+DOM.bip44coin.val()+"'/0'");
                DOM.hardenedAddresses.prop('checked', false);
            },
        }
    ]

    // RSK - RSK functions - begin
    function stripHexPrefix(address) {
        if (typeof address !== "string") {
            throw new Error("address parameter should be a string.");
        }

        var hasPrefix = (address.substring(0, 2) === "0x" ||
            address.substring(0, 2) === "0X");

        return hasPrefix ? address.slice(2) : address;
    };

    function toChecksumAddressForRsk(address, chainId = null) {
        if (typeof address !== "string") {
            throw new Error("address parameter should be a string.");
        }

        if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) {
            throw new Error("Given address is not a valid RSK address: " + address);
        }

        var stripAddress = stripHexPrefix(address).toLowerCase();
        var prefix = chainId != null ? chainId.toString() + "0x" : "";
        var keccakHash = libs.ethUtil.keccak256(prefix + stripAddress)
            .toString("hex")
            .replace(/^0x/i, "");
        var checksumAddress = "0x";

        for (var i = 0; i < stripAddress.length; i++) {
            checksumAddress +=
                parseInt(keccakHash[i], 16) >= 8 ?
                stripAddress[i].toUpperCase() :
                stripAddress[i];
        }

        return checksumAddress;
    }

    // RSK - RSK functions - end

    // ELA - Elastos functions - begin
    function displayBip44InfoForELA() {
        if (!isELA()) {
            return;
        }

        var coin = parseIntNoNaN(DOM.bip44coin.val(), 0);
        var account = parseIntNoNaN(DOM.bip44account.val(), 0);

        // Calculate the account extended keys
        var accountXprv = libs.elastosjs.getAccountExtendedPrivateKey(seed, coin, account);
        var accountXpub = libs.elastosjs.getAccountExtendedPublicKey(seed, coin, account);

        // Display the extended keys
        DOM.bip44accountXprv.val(accountXprv);
        DOM.bip44accountXpub.val(accountXpub);
    }

    function displayBip32InfoForELA() {
        if (!isELA()) {
            return;
        }

        var coin = parseIntNoNaN(DOM.bip44coin.val(), 0);
        var account = parseIntNoNaN(DOM.bip44account.val(), 0);
        var change = parseIntNoNaN(DOM.bip44change.val(), 0);

        DOM.extendedPrivKey.val(libs.elastosjs.getBip32ExtendedPrivateKey(seed, coin, account, change));
        DOM.extendedPubKey.val(libs.elastosjs.getBip32ExtendedPublicKey(seed, coin, account, change));

        // Display the addresses and privkeys
        clearAddressesList();
        var initialAddressCount = parseInt(DOM.rowsToAdd.val());
        displayAddresses(0, initialAddressCount);
    }

    function calcAddressForELA(seed, coin, account, change, index) {
        if (!isELA()) {
            return;
        }

        var publicKey = libs.elastosjs.getDerivedPublicKey(libs.elastosjs.getMasterPublicKey(seed), change, index);
        return {
            privateKey: libs.elastosjs.getDerivedPrivateKey(seed, coin, account, change, index),
            publicKey: publicKey,
            address: libs.elastosjs.getAddress(publicKey.toString('hex'))
        };
    }
    // ELA - Elastos functions - end

    init();

})(window);
