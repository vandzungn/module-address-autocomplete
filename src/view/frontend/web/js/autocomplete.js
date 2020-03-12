define([
    'jquery',
    'uiComponent',
    'ShipperHQ_AddressAutocomplete/js/google_maps_loader',
    'Magento_Checkout/js/checkout-data' ,
    'uiRegistry'
], function (
    $,
    Component,
    GoogleMapsLoader,
    checkoutData,
    uiRegistry
) {

    var componentForm = {
        subpremise: 'short_name',
        street_number: 'short_name',
        route: 'long_name',
        locality: 'long_name',
        administrative_area_level_1: 'long_name',
        country: 'short_name',
        postal_code: 'short_name',
        postal_code_suffix: 'short_name',
        postal_town: 'short_name',
        sublocality_level_1: 'short_name'
    };

    var lookupElement = {
        street_number: 'street_1',
        route: 'street_2',
        locality: 'city',
        administrative_area_level_1: 'region',
        country: 'country_id',
        postal_code: 'postcode'
    };

    var googleMapError = false;
    window.gm_authFailure = function() {
        googleMapError = true;
    };


    GoogleMapsLoader.done(function () {
        var enabled = window.checkoutConfig.shipperhq_autocomplete.active;

        var geocoder = new google.maps.Geocoder();
        setTimeout(function () {
            if(!googleMapError) {
                if (enabled == '1') {
                    var domID = uiRegistry.get('checkout.steps.shipping-step.shippingAddress.shipping-address-fieldset.street').elems()[0].uid;

                    var street = $('#' + domID);

                    //SHQ18-260
                    var observer = new MutationObserver(function () {
                        observer.disconnect();
                        $("#" + domID).attr("autocomplete", "new-password");
                    });

                    street.each(function () {
                        var element = this;

                        observer.observe(element, {
                            attributes: true,
                            attributeFilter: ['autocomplete']
                        });

                        autocomplete = new google.maps.places.Autocomplete(
                            /** @type {!HTMLInputElement} */(this),
                            {types: ['geocode']}
                        );
                        autocomplete.addListener('place_changed', fillInAddress);

                    });
                    $('#' + domID).focus(geolocate);
                }
            }
        }, 5000);

    }).fail(function () {
        console.error("ERROR: Google maps library failed to load");
    });

    function extractUnit(val, addr) {
        let regx = new RegExp('^(.*?)' + val);
        let m = regx.exec(addr);
        
        return (m && m.length >=1 ? m[1] : "").trim();
    }

    var fillInAddress = function () {
        var place = autocomplete.getPlace();

        var street = [];
        var region  = '';
        var streetNumber = '';
        var city = '';
        var postcode = '';
        var postcodeSuffix = '';

        for (var i = 0; i < place.address_components.length; i++) {
            var addressType = place.address_components[i].types[0];
            if (componentForm[addressType]) {
                var value = place.address_components[i][componentForm[addressType]];
                if (addressType == 'subpremise') {
                    streetNumber = value + '/';
                } else if (addressType == 'street_number') {
                    streetNumber = streetNumber + value;
                } else if (addressType == 'route') {
                    street[1] = value;
                } else if (addressType == 'administrative_area_level_1') {
                    region = value;
                } else if (addressType == 'sublocality_level_1') {
                    city = value;
                } else if (addressType == 'postal_town') {
                    city = value;
                } else if (addressType == 'locality' && city == '') {
                    //ignore if we are using one of other city values already
                    city = value;
                } else if (addressType == 'postal_code') {
                    postcode = value;
                    var thisDomID = uiRegistry.get('checkout.steps.shipping-step.shippingAddress.shipping-address-fieldset.postcode').uid
                    if ($('#'+thisDomID)) {
                        $('#'+thisDomID).val(postcode + postcodeSuffix);
                        $('#'+thisDomID).trigger('change');
                    }
                } else if (addressType == 'postal_code_suffix' && window.checkoutConfig.shipperhq_autocomplete.use_long_postcode) {
                    postcodeSuffix = '-' + value;
                    var thisDomID = uiRegistry.get('checkout.steps.shipping-step.shippingAddress.shipping-address-fieldset.postcode').uid
                    if ($('#'+thisDomID)) {
                        $('#'+thisDomID).val(postcode + postcodeSuffix);
                        $('#'+thisDomID).trigger('change');
                    }
                } else {
                    var elementId = lookupElement[addressType];
                    var thisDomID = uiRegistry.get('checkout.steps.shipping-step.shippingAddress.shipping-address-fieldset.'+ elementId).uid;
                    if ($('#'+thisDomID)) {
                        $('#'+thisDomID).val(value);
                        $('#'+thisDomID).trigger('change');
                    }
                }
            }
        }
        if (street.length > 0) {
            street[0] = streetNumber;
            var domID = uiRegistry.get('checkout.steps.shipping-step.shippingAddress.shipping-address-fieldset.street').elems()[0].uid;
            if (streetNumber && streetNumber.indexOf('/') == -1) {
                street[0] = extractUnit(streetNumber, $('#'+domID).val()) + streetNumber;
            }
            var streetString = street.join(' ');
            if ($('#'+domID)) {
                $('#'+domID).val(streetString);
                $('#'+domID).trigger('change');
            }
        }
        var cityDomID = uiRegistry.get('checkout.steps.shipping-step.shippingAddress.shipping-address-fieldset.city').uid;
        if ($('#'+cityDomID)) {
            $('#'+cityDomID).val(city);
            $('#'+cityDomID).trigger('change');
        }
        if (region != '') {
            if (uiRegistry.get('checkout.steps.shipping-step.shippingAddress.shipping-address-fieldset.region_id')) {
                var regionDomId = uiRegistry.get('checkout.steps.shipping-step.shippingAddress.shipping-address-fieldset.region_id').uid;
                if ($('#'+regionDomId)) {
                    //search for and select region using text
                    $('#'+regionDomId +' option')
                        .filter(function () {
                            return $.trim($(this).text()) == region;
                        })
                        .attr('selected',true);
                    $('#'+regionDomId).trigger('change');
                }
            }
            if (uiRegistry.get('checkout.steps.shipping-step.shippingAddress.shipping-address-fieldset.region_id_input')) {
                var regionDomId = uiRegistry.get('checkout.steps.shipping-step.shippingAddress.shipping-address-fieldset.region_id_input').uid;
                if ($('#'+regionDomId)) {
                    $('#'+regionDomId).val(region);
                    $('#'+regionDomId).trigger('change');
                }
            }
        }
    }

    geolocate = function () {
        if (navigator.geolocation && window.checkoutConfig.shipperhq_autocomplete.use_geolocation === '1') {
            navigator.geolocation.getCurrentPosition(function (position) {
                var geolocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                var circle = new google.maps.Circle({
                    center: geolocation,
                    radius: position.coords.accuracy
                });
                autocomplete.setBounds(circle.getBounds());
            });
        }
    }
    return Component;

});
