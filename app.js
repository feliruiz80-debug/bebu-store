const SPREADSHEET_ID = '1I9cYPIUgr6zv_kRUyeA7okSb--YGA1b7shqM4050cJs';
const WA_NUMBER = '543517694762';
const SHIPPING_COST = 2500;

let todosLosProductos = [];
let carrito = [];
let nivelActual = 'MARCAS';
let marcaSeleccionada = null;
let subcategoriaSeleccionada = null;
let selectedPayment = null;
let currentCartTotal = 0;

document.addEventListener('DOMContentLoaded', function() {
    cargarCarritoDesdeLocalStorage();
    actualizarBadge();
    iniciarTiendaBEBU();
    
    var backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', function(e) {
            e.preventDefault();
            volverNivelAnterior();
        });
    }
    
    var headerCart = document.getElementById('header-cart');
    if (headerCart) {
        headerCart.addEventListener('click', irAlCarrito);
    }
    
    var searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            buscarProductos(e.target.value);
        });
    }
    
    var searchClear = document.getElementById('search-clear');
    if (searchClear) {
        searchClear.addEventListener('click', limpiarBusqueda);
    }
});

async function iniciarTiendaBEBU() {
    var contenedor = document.getElementById('brands-grid');
    contenedor.innerHTML = '<div class="loading"><div class="spinner"></div>Cargando...</div>';

    try {
        var urlSheet = 'https://opensheet.elk.sh/' + SPREADSHEET_ID + '/Stock';
        var respuesta = await fetch(urlSheet);
        
        if (!respuesta.ok) {
            throw new Error('Error conectando');
        }

        var filas = await respuesta.json();
        
        if (!Array.isArray(filas) || filas.length === 0) {
            throw new Error('Base vacia');
        }

        procesarDatos(filas);
        renderizarMarcas();

    } catch (error) {
        console.error('Error:', error);
        contenedor.innerHTML = '<div class="error">Error al cargar base de datos</div>';
    }
}

function procesarDatos(filas) {
    todosLosProductos = [];
    var logoAppUrl_temp = '';

    filas.forEach(function(item, index) {
        var marca = (item['MARCA'] || '').toString().trim().toUpperCase();
        var logoMarca = (item['URL LOGO MARCA'] || '').toString().trim();
        var subcategoria = (item['SUBCATEGORIA'] || '').toString().trim();
        var descripcion = (item['DESCRIPCION'] || '').toString().trim();
        var imagen = (item['URL IMAGEN PRODUCTO'] || '').toString().trim();
        var precioBruto = item['PRECIO'];
        var logoGlobal = (item['URL LOGO DE LA APP'] || '').toString().trim();

        if (!logoAppUrl_temp && logoGlobal) {
            logoAppUrl_temp = logoGlobal;
        }

        var precioLimpio = limpiarPrecio(precioBruto);

        if (marca && descripcion && precioLimpio > 0) {
            todosLosProductos.push({
                id: index,
                marca: marca,
                logoMarca: logoMarca,
                subcategoria: subcategoria || 'GENERAL',
                descripcion: descripcion,
                imagen: imagen,
                precio: precioLimpio
            });
        }
    });

    if (logoAppUrl_temp) {
        var logoBox = document.getElementById('logo-box');
        if (logoBox) {
            logoBox.innerHTML = '<img src="' + logoAppUrl_temp + '" alt="Logo" onerror="this.parentElement.innerHTML=\'BEBU\'">';
        }
    }
}

function limpiarPrecio(valor) {
    if (!valor) return null;
    var str = String(valor).trim().replace(/[$\s]/g, '');
    if (/^\d+\.\d{3},\d{2}$/.test(str)) {
        str = str.replace(/\./g, '').replace(',', '.');
    } else if (/^\d+\.\d{3}$/.test(str) && !str.includes(',')) {
        str = str.replace(/\./g, '');
    } else if (/^\d+,\d{2}$/.test(str)) {
        str = str.replace(',', '.');
    } else {
        str = str.replace(/,/g, '');
    }
    var precio = parseFloat(str);
    return isNaN(precio) ? null : precio;
}

function formatearPrecio(numero) {
    return '$' + Math.round(numero).toLocaleString('es-AR');
}

function renderizarMarcas() {
    var marcasMap = {};
    todosLosProductos.forEach(function(p) {
        if (!marcasMap[p.marca]) {
            marcasMap[p.marca] = p.logoMarca || '';
        }
    });

    var contenedor = document.getElementById('brands-grid');
    var html = '';

    Object.keys(marcasMap).sort().forEach(function(marca) {
        var logo = marcasMap[marca];
        var totalProductos = todosLosProductos.filter(function(p) { return p.marca === marca; }).length;
        html += '<div class="brand-card" onclick="seleccionarMarca(\'' + marca + '\')">' +
            '<div class="brand-img">' + (logo ? '<img src="' + logo + '" alt="' + marca + '" onerror="this.style.display=\'none\'">' : marca[0]) + '</div>' +
            '<div class="brand-body"><div class="brand-name">' + marca + '</div><div class="brand-count">' + totalProductos + ' producto' + (totalProductos !== 1 ? 's' : '') + '</div></div>' +
            '</div>';
    });

    contenedor.innerHTML = html;
    mostrarSeccion('brands-view');
    nivelActual = 'MARCAS';
    actualizarBotones();
    var breadcrumbEl = document.getElementById('breadcrumb');
    if (breadcrumbEl) breadcrumbEl.classList.add('hidden');
}

function seleccionarMarca(marca) {
    marcaSeleccionada = marca;
    subcategoriaSeleccionada = null;
    renderizarSubcategorias(marca);
}

function renderizarSubcategorias(marca) {
    var productosDeMarca = todosLosProductos.filter(function(p) { return p.marca === marca; });
    var subcategoriasUnicas = Array.from(new Set(productosDeMarca.map(function(p) { return p.subcategoria; })));

    var contenedor = document.getElementById('subcats-grid');
    var html = '';

    subcategoriasUnicas.sort().forEach(function(subcat) {
        var cantidad = productosDeMarca.filter(function(p) { return p.subcategoria === subcat; }).length;
        html += '<div class="subcat-card" onclick="seleccionarSubcategoria(\'' + subcat + '\')">' +
            '<div class="subcat-name">' + subcat + '</div>' +
            '<div class="subcat-count">' + cantidad + ' producto' + (cantidad !== 1 ? 's' : '') + '</div>' +
            '</div>';
    });

    var subcatsLabel = document.getElementById('subcats-label');
    if (subcatsLabel) subcatsLabel.textContent = 'Lineas de ' + marca;
    contenedor.innerHTML = html;
    mostrarSeccion('subcats-view');
    nivelActual = 'SUBCATEGORIAS';
    actualizarBotones();
    actualizarBreadcrumb();
}

function seleccionarSubcategoria(subcat) {
    subcategoriaSeleccionada = subcat;
    renderizarProductos(marcaSeleccionada, subcat);
}

function renderizarProductos(marca, subcat) {
    var productosFiltrados = todosLosProductos.filter(function(p) { 
        return p.marca === marca && p.subcategoria === subcat; 
    });

    var contenedor = document.getElementById('products-grid');
    var html = '';

    if (productosFiltrados.length === 0) {
        html = '<div class="empty-state" style="grid-column:1/-1"><div class="ei">Sin productos</div></div>';
    } else {
        productosFiltrados.forEach(function(p) {
            html += '<div class="product-card">' +
                '<div class="product-img">' + (p.imagen ? '<img src="' + p.imagen + '" alt="' + p.descripcion + '" onerror="this.style.display=\'none\'">' : '') + '</div>' +
                '<div class="product-body"><div><div class="product-brand">' + p.marca + ' - ' + p.subcategoria + '</div>' +
                '<div class="product-name">' + p.descripcion + '</div><div class="product-price">' + formatearPrecio(p.precio) + '</div></div>' +
                '<div class="product-buttons">' +
                '<button class="btn btn-add" onclick="agregarAlCarrito(' + p.id + ')">Agregar</button>' +
                '<button class="btn btn-wa" onclick="comprarPorWhatsApp(' + p.id + ')">WhatsApp</button>' +
                '</div></div></div>';
        });
    }

    var prodLabel = document.getElementById('products-label');
    if (prodLabel) prodLabel.textContent = subcat + ' - ' + productosFiltrados.length + ' producto' + (productosFiltrados.length !== 1 ? 's' : '');
    contenedor.innerHTML = html;
    mostrarSeccion('products-view');
    nivelActual = 'PRODUCTOS';
    actualizarBotones();
    actualizarBreadcrumb();
}

function buscarProductos(texto) {
    var clearBtn = document.getElementById('search-clear');
    
    if (!texto || texto.trim().length === 0) {
        if (clearBtn) clearBtn.style.display = 'none';
        if (subcategoriaSeleccionada && marcaSeleccionada) {
            renderizarProductos(marcaSeleccionada, subcategoriaSeleccionada);
        } else if (marcaSeleccionada) {
            renderizarSubcategorias(marcaSeleccionada);
        } else {
            renderizarMarcas();
        }
        return;
    }

    if (clearBtn) clearBtn.style.display = 'block';

    var query = texto.toLowerCase().trim();
    var resultados = todosLosProductos.filter(function(p) {
        return p.descripcion.toLowerCase().includes(query) ||
               p.marca.toLowerCase().includes(query) ||
               p.subcategoria.toLowerCase().includes(query);
    });

    renderizarResultadosBusqueda(resultados, texto);
}

function renderizarResultadosBusqueda(resultados, query) {
    var contenedor = document.getElementById('search-grid');
    var html = '';

    if (resultados.length === 0) {
        html = '<div class="empty-state" style="grid-column:1/-1"><div class="ei">Sin resultados</div></div>';
    } else {
        resultados.forEach(function(p) {
            html += '<div class="product-card">' +
                '<div class="product-img">' + (p.imagen ? '<img src="' + p.imagen + '" alt="' + p.descripcion + '" onerror="this.style.display=\'none\'">' : '') + '</div>' +
                '<div class="product-body"><div><div class="product-brand">' + p.marca + ' - ' + p.subcategoria + '</div>' +
                '<div class="product-name">' + p.descripcion + '</div><div class="product-price">' + formatearPrecio(p.precio) + '</div></div>' +
                '<div class="product-buttons">' +
                '<button class="btn btn-add" onclick="agregarAlCarrito(' + p.id + ')">Agregar</button>' +
                '<button class="btn btn-wa" onclick="comprarPorWhatsApp(' + p.id + ')">WhatsApp</button>' +
                '</div></div></div>';
        });
    }

    var searchCount = document.getElementById('search-count-label');
    if (searchCount) searchCount.textContent = resultados.length + ' resultado' + (resultados.length !== 1 ? 's' : '') + ' para "' + query + '"';
    contenedor.innerHTML = html;
    mostrarSeccion('search-view');
    nivelActual = 'BUSQUEDA';
    actualizarBotones();
}

function limpiarBusqueda() {
    var searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    var searchClear = document.getElementById('search-clear');
    if (searchClear) searchClear.style.display = 'none';
    buscarProductos('');
}

function agregarAlCarrito(id) {
    var producto = todosLosProductos.find(function(p) { return p.id === id; });
    if (!producto) return;

    var itemId = producto.marca + '__' + producto.subcategoria + '__' + producto.descripcion;
    var itemExistente = carrito.find(function(item) { return item.id === itemId; });

    if (itemExistente) {
        itemExistente.cantidad++;
    } else {
        carrito.push({
            id: itemId,
            nombre: producto.descripcion,
            marca: producto.marca,
            subcategoria: producto.subcategoria,
            precio: producto.precio,
            cantidad: 1
        });
    }

    guardarCarritoEnLocalStorage();
    actualizarBadge();
    mostrarNotificacion('Agregado al carrito');
}

function comprarPorWhatsApp(id) {
    var producto = todosLosProductos.find(function(p) { return p.id === id; });
    if (!producto) return;

    var mensaje = 'Hola! Me interesa: ' + producto.descripcion + ' - ' + formatearPrecio(producto.precio);
    var url = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(mensaje);
    window.open(url, '_blank');
}

function actualizarCantidad(idx, delta) {
    if (idx < 0 || idx >= carrito.length) return;
    carrito[idx].cantidad += delta;
    if (carrito[idx].cantidad <= 0) {
        carrito.splice(idx, 1);
    }
    guardarCarritoEnLocalStorage();
    actualizarBadge();
    renderizarCarrito();
}

function eliminarDelCarrito(idx) {
    carrito.splice(idx, 1);
    guardarCarritoEnLocalStorage();
    actualizarBadge();
    renderizarCarrito();
}

function guardarCarritoEnLocalStorage() {
    try {
        localStorage.setItem('bebu-carrito', JSON.stringify(carrito));
    } catch(e) {}
}

function cargarCarritoDesdeLocalStorage() {
    try {
        var guardado = localStorage.getItem('bebu-carrito');
        if (guardado) {
            carrito = JSON.parse(guardado);
        }
    } catch(e) {
        carrito = [];
    }
}

function actualizarBadge() {
    var totalItems = 0;
    carrito.forEach(function(item) { totalItems += item.cantidad; });
    var badge = document.getElementById('badge');
    if (!badge) return;
    if (totalItems > 0) {
        badge.textContent = totalItems > 9 ? '9+' : totalItems;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function irAlCarrito() {
    renderizarCarrito();
    mostrarSeccion('cart-view');
    nivelActual = 'CARRITO';
    actualizarBotones();
}

function renderizarCarrito() {
    var cartWrap = document.getElementById('cart-wrap');
    if (!cartWrap) return;

    if (carrito.length === 0) {
        cartWrap.innerHTML = '<div class="cart-empty"><div class="cart-empty-icon">Carrito vacio</div><p>Tu carrito esta vacio</p></div>' +
            '<button class="btn-checkout back" onclick="volverNivelAnterior()">Seguir comprando</button>';
        return;
    }

    currentCartTotal = 0;
    carrito.forEach(function(item) {
        currentCartTotal += item.precio * item.cantidad;
    });

    var html = '<div class="cart-items">';
    carrito.forEach(function(item, idx) {
        html += '<div class="cart-item">' +
            '<div class="cart-item-info">' +
            '<div class="cart-item-brand">' + item.marca + ' - ' + item.subcategoria + '</div>' +
            '<div class="cart-item-name">' + item.nombre + '</div>' +
            '<div class="cart-item-price">' + formatearPrecio(item.precio) + ' c/u</div>' +
            '</div>' +
            '<div class="cart-item-controls">' +
            '<button class="qty-btn" onclick="actualizarCantidad(' + idx + ', -1)">-</button>' +
            '<span class="qty-num">' + item.cantidad + '</span>' +
            '<button class="qty-btn" onclick="actualizarCantidad(' + idx + ', 1)">+</button>' +
            '<button class="del-btn" onclick="eliminarDelCarrito(' + idx + ')">x</button>' +
            '</div></div>';
    });
    html += '</div>';

    var shippingToggle = document.getElementById('shipping-toggle');
    var conEnvio = shippingToggle ? shippingToggle.checked : false;
    var totalFinal = currentCartTotal + (conEnvio ? SHIPPING_COST : 0);

    html += '<div class="cart-summary">' +
        '<div class="summary-line"><span>Subtotal</span><span>' + formatearPrecio(currentCartTotal) + '</span></div>' +
        (conEnvio ? '<div class="summary-line"><span>Envio a domicilio</span><span>+ ' + formatearPrecio(SHIPPING_COST) + '</span></div>' : '') +
        '<div class="summary-line"><span>TOTAL</span><span>' + formatearPrecio(totalFinal) + '</span></div>' +
        '</div>';

    html += '<div class="shipping-box" id="shipping-box">' +
        '<div class="shipping-toggle-row">' +
        '<div class="shipping-label-group">' +
        '<div class="shipping-title">Con envio a domicilio?</div>' +
        '<div class="shipping-subtitle">+ ' + formatearPrecio(SHIPPING_COST) + '</div>' +
        '</div>' +
        '<label class="toggle-wrap">' +
        '<input type="checkbox" id="shipping-toggle" onchange="actualizarResumenCarrito()">' +
        '<div class="toggle-track"></div>' +
        '<div class="toggle-thumb"></div>' +
        '</label>' +
        '</div>' +
        '<div class="shipping-address-wrap" id="shipping-address-wrap">' +
        '<span class="shipping-address-label">Direccion de entrega</span>' +
        '<textarea class="shipping-address-input" id="shipping-address" placeholder="Ingresa direccion..." rows="3"></textarea>' +
        '</div>' +
        '</div>';

    html += '<div class="payment-options">' +
        '<span class="payment-title">Forma de Pago</span>' +
        '<div class="payment-buttons">' +
        '<button class="payment-btn" onclick="seleccionarPago(\'transfer\')"><span>Transferencia</span></button>' +
        '<button class="payment-btn" onclick="seleccionarPago(\'cash\')"><span>Efectivo</span></button>' +
        '</div>' +
        '<div class="cash-amount-wrap" id="cash-amount-wrap">' +
        '<span class="cash-amount-label">Con cuanto vas a pagar?</span>' +
        '<input type="number" class="cash-amount-input" id="cash-amount" placeholder="Monto..." oninput="calcularVuelto()">' +
        '<div class="cash-change-info" id="cash-change-info"></div>' +
        '</div>' +
        '</div>';

    html += '<button class="btn-checkout green" onclick="enviarPedidoWhatsApp()">Enviar pedido por WhatsApp</button>' +
        '<button class="btn-checkout back" onclick="volverNivelAnterior()">Seguir comprando</button>';

    cartWrap.innerHTML = html;
}

function actualizarResumenCarrito() {
    var shippingToggle = document.getElementById('shipping-toggle');
    var addressWrap = document.getElementById('shipping-address-wrap');
    var shippingBox = document.getElementById('shipping-box');
    if (!shippingToggle) return;

    if (shippingToggle.checked) {
        addressWrap.classList.add('open');
        shippingBox.classList.add('active');
    } else {
        addressWrap.classList.remove('open');
        shippingBox.classList.remove('active');
    }
}

function seleccionarPago(metodo) {
    selectedPayment = metodo;
    var botones = document.querySelectorAll('.payment-btn');
    botones.forEach(function(btn) { btn.classList.remove('active'); });
    if (event && event.target) {
        var btnTarget = event.target.closest('.payment-btn');
        if (btnTarget) btnTarget.classList.add('active');
    }

    var cashWrap = document.getElementById('cash-amount-wrap');
    if (!cashWrap) return;
    if (metodo === 'cash') {
        cashWrap.classList.add('open');
    } else {
        cashWrap.classList.remove('open');
    }
}

function calcularVuelto() {
    var shippingToggle = document.getElementById('shipping-toggle');
    var totalFinal = currentCartTotal + (shippingToggle && shippingToggle.checked ? SHIPPING_COST : 0);
    var cashInput = document.getElementById('cash-amount');
    var infoEl = document.getElementById('cash-change-info');
    if (!cashInput || !infoEl) return;

    var paga = parseFloat(cashInput.value) || 0;

    if (paga <= 0) {
        infoEl.className = 'cash-change-info';
        infoEl.textContent = '';
        return;
    }

    if (paga >= totalFinal) {
        infoEl.className = 'cash-change-info success';
        infoEl.textContent = 'Vuelto: ' + formatearPrecio(paga - totalFinal);
    } else {
        infoEl.className = 'cash-change-info error';
        infoEl.textContent = 'Falta: ' + formatearPrecio(totalFinal - paga);
    }
}

// -----------------------------------------------------------------
// CORRECCIÓN 1: Mensaje de WhatsApp limpio y ordenado sin duplicados
// -----------------------------------------------------------------
function enviarPedidoWhatsApp() {
    if (carrito.length === 0) {
        mostrarNotificacion('El carrito esta vacio');
        return;
    }

    if (!selectedPayment) {
        mostrarNotificacion('Selecciona forma de pago');
        return;
    }

    var shippingToggle = document.getElementById('shipping-toggle');
    var conEnvio = shippingToggle && shippingToggle.checked;

    var address = '';
    if (conEnvio) {
        var addressInput = document.getElementById('shipping-address');
        address = addressInput ? addressInput.value.trim() : '';
        if (!address) {
            mostrarNotificacion('Ingresa direccion de entrega');
            return;
        }
    }

    var mensaje = '*PEDIDO BEBU*\n\n';
    mensaje += '*DETALLE DEL PEDIDO*\n';
    
    carrito.forEach(function(item) {
        var subtotal = item.precio * item.cantidad;
        mensaje += '• ' + item.cantidad + 'x ' + item.nombre + ' (' + formatearPrecio(item.precio) + ' c/u) = ' + formatearPrecio(subtotal) + '\n';
    });

    var totalFinal = currentCartTotal;
    if (conEnvio) {
        totalFinal += SHIPPING_COST;
    }

    mensaje += '\n*RESUMEN DE PAGO*\n';
    mensaje += '• Subtotal: ' + formatearPrecio(currentCartTotal) + '\n';
    if (conEnvio) {
        mensaje += '• Envio a domicilio: ' + formatearPrecio(SHIPPING_COST) + '\n';
    }
    mensaje += '• TOTAL A PAGAR: ' + formatearPrecio(totalFinal) + '\n\n';

    mensaje += '*METODO DE ENTREGA*\n';
    if (conEnvio) {
        mensaje += '• Direccion: ' + address + '\n\n';
    } else {
        mensaje += '• Retiro en local\n\n';
    }

    mensaje += '*FORMA DE PAGO*\n';
    if (selectedPayment === 'transfer') {
        mensaje += '• Transferencia Bancaria\n';
    } else if (selectedPayment === 'cash') {
        var cashInput = document.getElementById('cash-amount');
        var paga = cashInput ? (parseFloat(cashInput.value) || 0) : 0;
        mensaje += '• Efectivo\n';
        if (paga > 0) {
            var vuelto = paga - totalFinal;
            mensaje += '• Paga con: ' + formatearPrecio(paga) + '\n';
            if (vuelto >= 0) {
                mensaje += '• Vuelto: ' + formatearPrecio(vuelto) + '\n';
            }
        }
    }

    mensaje += '\n_¡Estamos atentos a la confirmacion del pedido!_';

    var url = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(mensaje);
    window.open(url, '_blank');

    setTimeout(function() {
        carrito = [];
        guardarCarritoEnLocalStorage();
        actualizarBadge();
        volverNivelAnterior();
    }, 500);
}

// -----------------------------------------------------------------
// CORRECCIÓN 2: Lógica robusta para el botón Volver según el nivel activo
// -----------------------------------------------------------------
function volverNivelAnterior() {
    var searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    var searchClear = document.getElementById('search-clear');
    if (searchClear) searchClear.style.display = 'none';

    // Si estamos en el carrito, volvemos a la subcategoría, marca o inicio según lo que esté guardado
    if (nivelActual === 'CARRITO') {
        if (subcategoriaSeleccionada && marcaSeleccionada) {
            renderizarProductos(marcaSeleccionada, subcategoriaSeleccionada);
        } else if (marcaSeleccionada) {
            renderizarSubcategorias(marcaSeleccionada);
        } else {
            renderizarMarcas();
        }
    } 
    // Si estamos en productos, volvemos a las subcategorías de esa marca
    else if (nivelActual === 'PRODUCTOS') {
        if (marcaSeleccionada) {
            renderizarSubcategorias(marcaSeleccionada);
        } else {
            renderizarMarcas();
        }
    } 
    // Si estamos en subcategorías o en búsqueda, volvemos a las marcas principales
    else if (nivelActual === 'SUBCATEGORIAS' || nivelActual === 'BUSQUEDA') {
        marcaSeleccionada = null;
        subcategoriaSeleccionada = null;
        renderizarMarcas();
    } 
    // Por cualquier otro caso de emergencia, vamos directo al inicio
    else {
        marcaSeleccionada = null;
        subcategoriaSeleccionada = null;
        renderizarMarcas();
    }
}

function mostrarSeccion(id) {
    var secciones = document.querySelectorAll('.section');
    secciones.forEach(function(sec) {
        sec.classList.remove('active');
    });
    var seccion = document.getElementById(id);
    if (seccion) {
        seccion.classList.add('active');
    }
    var contentEl = document.querySelector('.content');
    if (contentEl) {
        contentEl.scrollTop = 0;
    }
}

function actualizarBotones() {
    var backBtn = document.getElementById('back-btn');
    if (!backBtn) return;
    
    // Si estamos en el inicio (Marcas), lo ocultamos a la fuerza
    if (nivelActual === 'MARCAS') {
        backBtn.style.display = 'none';
    } else {
        // En cualquier otra pantalla, lo mostramos bien visible
        backBtn.style.display = 'inline-block';
    }
}

function actualizarBreadcrumb() {
    var bc = document.getElementById('breadcrumb');
    if (!bc) return;
    if (nivelActual === 'MARCAS') {
        bc.classList.add('hidden');
        return;
    }
    bc.classList.remove('hidden');
    var html = '<span class="bc-item" onclick="irAlInicio()">Inicio</span>';
    if (marcaSeleccionada) {
        html += ' > ' + marcaSeleccionada;
        if (subcategoriaSeleccionada) {
            html += ' > ' + subcategoriaSeleccionada;
        }
    }
    bc.innerHTML = html;
}

function irAlInicio() {
    marcaSeleccionada = null;
    subcategoriaSeleccionada = null;
    var searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    renderizarMarcas();
}

function mostrarNotificacion(msg) {
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function() {
        toast.remove();
    }, 2500);
}