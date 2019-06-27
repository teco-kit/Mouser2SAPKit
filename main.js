import Nightmare from 'nightmare'
import XLSX from 'xlsx'

// URL CONSTANTS
const URL_LOGIN = 'https://www.mouser.de/MyAccount/MouserLogin'
const URL_ORDER_OVERVIEW = "https://www.mouser.de/OrderHistory/OrdersView.aspx"

// SELECTORS CONSTANTS
const USERNAME_INPUT_SELECTOR = 'input#Username.form-control'
const PASSWORD_INPUT_SELECTOR = 'input#Password.form-control'
const LOGIN_BUTTON_SELECTOR = 'button#LoginButton.btn.btn-primary'

// XLSX CONSTANTS
const DESCRIPTION = "DESCRIPTION"
const CATEGORY_ID = "CATEGORY_ID"
const SUPPLIER_PROD_NO = "SUPPLIER_PROD_NO"
const PRICE_UNIT = "PRICE_UNIT"
const QUANTITY = "QUANTITY"
const UNIT = "UNIT"
const PRICE = "PRICE"
const CURRENCY = "CURRENCY"
const SUPPLIER_ID = "SUPPLIER_ID"
const SUPPLIER_NOTE = "SUPPLIER_NOTE"
const FIXED_SUPPLIER = "FIXED_SUPPLIER"
const NOTE = "NOTE"
const TAX_CODE = "TAX_CODE"
const COST_CTR = "COST_CTR"
const ORDER_NO = "ORDER_NO"
const PSP_ELEMENT = "PSP_ELEMENT"
const KD_SUP = "KD_SUP"
const SUP_EMAIL = "SUP_EMAIL"
const OFFER_NO = "OFFER_NO"

const ORDERED_FIELDS = [DESCRIPTION, CATEGORY_ID, SUPPLIER_PROD_NO, PRICE_UNIT,
  QUANTITY, UNIT, PRICE, CURRENCY, SUPPLIER_ID, SUPPLIER_NOTE, FIXED_SUPPLIER,
  NOTE, TAX_CODE, COST_CTR, ORDER_NO, PSP_ELEMENT, KD_SUP, SUP_EMAIL, OFFER_NO]

const DEFAULT_PREFIX = "DEFAULT_"

global[DEFAULT_PREFIX + CATEGORY_ID] = "9947"
global[DEFAULT_PREFIX + PRICE_UNIT] = "100"
global[DEFAULT_PREFIX + UNIT] = "ST"
global[DEFAULT_PREFIX + CURRENCY] = "EUR"
global[DEFAULT_PREFIX + SUPPLIER_ID] = "937663"

// COMMAND LINE ARGS
let username = ""
let password = ""
let salesOrderNo = ""

process.argv.forEach(function (val, index, array) {
  switch (index) {
    case 2:
      username = val;
      break;
    case 3:
      password = val;
      break;
    case 4:
      salesOrderNo = val;
      break;
  }
})

// STARTING SCRIPTS
console.log("Starting to scrape your order ...\n")
console.log(`Username       : ${username}`);
console.log(`Password       : ${password}`);
console.log(`Sales Order No.: ${salesOrderNo}\n`)

const nightmare = new Nightmare({ show: true }).viewport(800, 600);
(async () => {
  await nightmare
    .goto(URL_LOGIN)
    .wait(USERNAME_INPUT_SELECTOR)
    .click(USERNAME_INPUT_SELECTOR)
    .type(USERNAME_INPUT_SELECTOR, username)
    .wait(500)
    .click(PASSWORD_INPUT_SELECTOR)
    .type(PASSWORD_INPUT_SELECTOR, password)
    .wait(500)
    .click(LOGIN_BUTTON_SELECTOR)
    .wait(500)
    .goto(URL_ORDER_OVERVIEW)
    .wait(2000)
    .evaluate((salesOrderNo) => {
      var allOrders = document.getElementsByTagName('a');
      for (var i = 0; i < allOrders.length; i++) {
        if (allOrders[i].innerText == salesOrderNo) allOrders[i].id = 'selectedOrderButton';
      }
    }, salesOrderNo)
    .click('a[id=selectedOrderButton]')
    .wait(500)
    .evaluate(() => {
      var whiteCells = document.getElementsByClassName('cartRowWhite')
      var greyCells = document.getElementsByClassName('alt-grey')

      for (var i = 0; i < whiteCells.length; i++) {
        whiteCells[i].classList.add('cartItemKITIdentifier')
      }

      for (var i = 0; i < greyCells.length; i++) {
        greyCells[i].classList.add('cartItemKITIdentifier')
      }
    })
    .evaluate(() => {
      var allItems = document.getElementsByClassName('cartItemKITIdentifier');
      var processedItems = []
      for (var i = 0; i < allItems.length; i++) {
        var price = parseFloat(allItems[i].getElementsByClassName("td-price")["0"].innerText.replace(" €", "").replace(",", "."))
        var quantity = allItems[i].getElementsByClassName("td-qty")["0"].innerText
        var supplierProdNo = allItems[i].querySelector("#row_MPN > td:nth-of-type(2)").innerText
        var description = allItems[i].querySelector(".cartProdDetailcell > tbody > tr:nth-of-type(3) > td:nth-of-type(2)").innerText

        processedItems.push(
          {
            PRICE: price * 100, // * 100 because of price unit
            QUANTITY: quantity,
            SUPPLIER_PROD_NO: supplierProdNo,
            DESCRIPTION: description
          }
        );
      }
      return processedItems;
    })
    .end()
    .then(function (salesOrderItems) {
      let xlsxArray = new Array();
      ORDERED_FIELDS.forEach((field, index) => {
        xlsxArray.push([field])
        if (salesOrderItems[0][field] !== undefined)
        {
          salesOrderItems.forEach((salesOrderItem) => 
          {
            xlsxArray[index].push(salesOrderItem[field]);
          });
        } 
        else if (global[DEFAULT_PREFIX + field] !== undefined)
        {
          for(let i = 0; i < salesOrderItems.length; i++) 
          {
            xlsxArray[index].push(global[DEFAULT_PREFIX + field]);
          }
        }
        else
        {
          for(let i = 0; i < salesOrderItems.length; i++) 
          {
            xlsxArray[index].push("");
          }
        }
      });
      let xlsxArrayTransposed = xlsxArray[0].map((x,i) => xlsxArray.map(x => x[i]))

      let wb = XLSX.utils.book_new();
      wb.Props = {
        Title: salesOrderNo,
        Subject: salesOrderNo,
        CreatedDate: new Date()
      };
      wb.SheetNames.push(salesOrderNo);
      var ws = XLSX.utils.aoa_to_sheet(xlsxArrayTransposed);
      wb.Sheets[salesOrderNo] = ws;
      XLSX.writeFile(wb, `${salesOrderNo}.xlsx`);

      console.log(`Scraping done. Stored your order as ${salesOrderNo}.xlsx!`)
    });
})();