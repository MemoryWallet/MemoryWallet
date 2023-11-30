(function (global) {
  "use strict";
  let GLOBAL_SHARE_COUNTER = 0;
  const SUPPORTED_ALT_COINS = ['litecoin', 'ethereum', 'segwit', 'oxen', 'monero', 'solana'];
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
    console.log('btn clicked');
    event.preventDefault();
    $('.tos-container').show();
    $('body').addClass('tos-show');
  });

  $('.tos-footer button').click(function (event) {
    event.stopPropagation();
    $('.tos-container').hide();
    $('body').removeClass('tos-show');
    generateCoins();
  });

  function setMnemonicFromEntropy(entropyStr) {
      var mnemonics = { "english": new Mnemonic("english") };
      var mnemonic = mnemonics["english"];
      //// clearEntropyFeedback();
      // Get entropy value
      //// var entropyStr = DOM.entropy.val();
      // Work out minimum base for entropy
      var entropy = null;
      //// if (entropyTypeAutoDetect) {
          entropy = Entropy.fromString(entropyStr);
		  console.log('entropy',entropy);
      //// }
      //// else {
      ////     let base = DOM.entropyTypeInputs.filter(":checked").val();
      ////     entropy = Entropy.fromString(entropyStr, base);
      //// }
      if (entropy.binaryStr.length == 0) {
          return 'failure';
      }
      // Show entropy details
      //// showEntropyFeedback(entropy);
      // Use entropy hash if not using raw entropy
      var bits = entropy.binaryStr;
      // var mnemonicLength = '24'; // hardcoding, was DOM.entropyMnemonicLength.val();
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
		  console.log('mnemonicLength',mnemonicLength);
          var numberOfBits = 32 * mnemonicLength / 3;
          bits = bits.substring(0, numberOfBits);
          // show warning for weak entropy override
          if (mnemonicLength / 3 * 32 > entropy.binaryStr.length) {
              //// DOM.entropyWeakEntropyOverrideWarning.removeClass("hidden");
			  console.log("1st case");
          }
          else {
              //// DOM.entropyWeakEntropyOverrideWarning.addClass("hidden");
			  console.log("2nd case");
          }
      }
      else {
          // hide warning for weak entropy override
          //DOM.entropyWeakEntropyOverrideWarning.addClass("hidden");
		  console.log('falling through');
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
	  console.log('phrase',phrase);

      // Set the mnemonic in the UI
      //// DOM.phrase.val(phrase);
      //// writeSplitPhrase(phrase);
      // Show the word indexes
      //// showWordIndexes();
      // Show the checksum
      //// showChecksum();
	  return phrase;
  }

  function generateCoins() {
    let power = $('input[name="power-level"]:checked').val();;
    setResult('.date', 'Created ' + createdDate);
    const params = {
      power: power,
      currency: 'bitcoin',
      privateKey: null,
      altCoin: false
    };

    generate(params, result => {
	  /*
      setResult('#btcpub', result.public);
      setResult('#btcpri', result.private);
	  setResult('#btckey', result.key);
	  */
	  console.log('!!## main.js setResult entropy ... entropyChanged');
	  setResult('#entropy', result.key);
	  //entropyChanged();
	  /*
	  var theMnemonic = setMnemonicFromEntropy(result.key);// the key is the entropy, the medium is the massage
	  setResult('#btcmnemonic', theMnemonic);

	  //setResult('#btcderivedaddresses', '<tr><td>m/44\'/0\'/0\'/0/0</td><td>1CRq4jYXiEiEkysWaFjVAmHj44N1wCM5V8</td><td>02261f4c6e7fac81bdc60672dbace8f49f2aac13d3446e38f741ccf94058083d32</td><td>L1jJS6ZWMWgj15UneB5UyibUJE8FngR6GyE4E4rMEkf6qt1fuCqe</td></tr>');
      var x = 'm/44\'/0\'/0\'/0/0';
	  setResult('#btcpath1', x);

	  x = '1CRq4jYXiEiEkysWaFjVAmHj44N1wCM5V8';
	  setResult('#btcaddr1', x);

	  x = '02261f4c6e7fac81bdc60672dbace8f49f2aac13d3446e38f741ccf94058083d32';
	  setResult('#btcpub1', x);

	  x = 'L1jJS6ZWMWgj15UneB5UyibUJE8FngR6GyE4E4rMEkf6qt1fuCqe';
	  setResult('#btcpriv1', x);
	  */

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
      generateAltCoins(result.private, power);
      generateEOS(result.private);
    });
  }

  function generateAltCoins(privateKey, power) {
    const params = {
      power: power,
      currency: null,
      privateKey: privateKey,
      altCoin: true
    };
    for (let altcoin of SUPPORTED_ALT_COINS) {
      let alt = altCoinCode(altcoin);
      params.currency = altcoin;
      $('#progress center').text('Generating alt coins...');
      generate(params, result => {
        validateKeys(alt, result) 

        drawIdenticon(`.i-${alt}`, result.public);

        if (alt == 'oxen' || alt == 'xmr') {
          setResult(`#${alt}pub`, result.public);
          // setResult(`#xmrpub-spend`, result.public_spend);
          setResult(`#${alt}pri-spend`, result.private_spend);
          // setResult(`#xmrpub-view`, result.public_view);
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
    $('#login-box').toggle();
    $('.result-btn').toggle();
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
    const coinKeys = getDefinedKeyLength(coin);

    if(Object.prototype.toString.apply(coinKeys) !== "[object Object]") return; 

    for(let i = 0; i < Object.keys(coinKeys).length; i++) {
      const key = Object.keys(coinKeys)[i];
      if((coinKeys[key] !== addresses[key].length) && (coin != 'sol')) {
        alert(`Please choose another username and password combination. Error: ${coin.toUpperCase()}`);
        window.location.reload(); 
        break;
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
        private_spend: 64
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

})(window);
