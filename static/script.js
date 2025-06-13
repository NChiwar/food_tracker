async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Fetch error for ${url}:`, error);
        throw error;
    }
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = show ? 'block' : 'none';
    }
}

function clearNoDataWarnings() {
    const noDataElements = document.querySelectorAll('td[colspan="5"][class="text-center"]');
    noDataElements.forEach(el => {
        if (el.textContent === 'No data available') {
            el.parentElement.remove();
        }
    });
}

function renderPagination(currentPage, totalPages, loadFunction) {
    const pagination = document.createElement('nav');
    pagination.className = 'mt-3';
    const ul = document.createElement('ul');
    ul.className = 'pagination justify-content-center';

    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === currentPage ? 'active' : ''}`;
        const a = document.createElement('a');
        a.className = 'page-link';
        a.href = '#';
        a.textContent = i;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            loadFunction(i);
        });
        li.appendChild(a);
        ul.appendChild(li);
    }

    pagination.appendChild(ul);
    const paginationContainer = document.getElementById('pagination');
    if (paginationContainer) {
        paginationContainer.innerHTML = '';
        paginationContainer.appendChild(pagination);
    }
}

async function initPricesPage() {
    showLoading(true);
    console.log("Initializing Prices page");
    try {
        const years = await fetchData('/api/years');
        const yearFilter = document.getElementById('yearFilter');
        if (yearFilter) {
            yearFilter.innerHTML = '<option value="all">All Years</option>';
            years.forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearFilter.appendChild(option);
            });
        } else {
            console.error("yearFilter element not found");
        }

        const foods = await fetchData('/api/foods');
        const foodFilter = document.getElementById('foodFilter');
        if (!foodFilter) {
            console.error('Food filter element not found');
            return;
        }
        foodFilter.innerHTML = '<option value="all">All Foods</option>';
        foods.forEach(food => {
            const option = document.createElement('option');
            option.value = food.toLowerCase();
            option.textContent = food;
            foodFilter.appendChild(option);
        });

        const markets = await fetchData('/api/markets');
        const regionFilter = document.getElementById('regionFilter');
        if (!regionFilter) {
            console.error('Region filter element not found');
            return;
        }
        regionFilter.innerHTML = '<option value="all">All Markets</option>';
        markets.forEach(market => {
            const option = document.createElement('option');
            option.value = market.toLowerCase();
            option.textContent = market;
            regionFilter.appendChild(option);
        });

        await loadPriceTable(1);
    } catch (error) {
        console.error('Error initializing prices page:', error);
        alert('Failed to load price data. Please try again later.');
    } finally {
        showLoading(false);
    }
}

async function loadPriceTable(page = 1) {
    const stateFilter = document.getElementById('stateFilter');
    const regionFilter = document.getElementById('regionFilter');
    const foodFilter = document.getElementById('foodFilter');
    const yearFilter = document.getElementById('yearFilter');
    const sortBy = document.getElementById('sortBy');

    console.log("Loading price table for page:", page);
    if (!stateFilter || !regionFilter || !foodFilter || !yearFilter || !sortBy) {
        console.error('Filter elements missing:', { stateFilter, regionFilter, foodFilter, yearFilter, sortBy });
        return;
    }

    const state = stateFilter.value.toLowerCase();
    const region = regionFilter.value.toLowerCase();
    const food = foodFilter.value.toLowerCase();
    const year = yearFilter.value;

    const params = new URLSearchParams({ state, market: region, food_item: food, year, page: page, per_page: 20 });
    let response;
    try {
        response = await fetchData(`/api/food-prices?${params}`);
        console.log("API response:", response);
    } catch (error) {
        console.error('Failed to fetch price data:', error);
        return;
    }

    const tableBody = document.querySelector('#priceTable tbody');
    if (!tableBody) {
        console.error('Price table body not found');
        return;
    }
    tableBody.innerHTML = '';

    if (!response.data || response.data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No data available</td></tr>';
        console.warn("No data returned from API");
        renderPagination(1, 0, loadPriceTable);
    } else {
        response.data.sort((a, b) => {
            if (sortBy.value === 'price-desc') return b.price - a.price;
            return a.price - b.price;
        });

        response.data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.foodItem || 'N/A'}</td>
                <td>${item.state || 'N/A'}</td>
                <td>${item.region || 'N/A'}</td>
                <td>₦${(item.price || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                <td>${item.availability || 'N/A'}</td>
            `;
            tableBody.appendChild(row);
        });

        renderPagination(response.current_page, response.total_pages, loadPriceTable);
    }

    updateCsvDownload(response.data);
    clearNoDataWarnings();
}

function updateCsvDownload(data) {
    const csvButton = document.getElementById('downloadCsv');
    if (!csvButton) {
        console.error('CSV download button not found');
        return;
    }

    const headers = ['Food Item', 'State', 'Market', 'Price (NGN)', 'Availability', 'Date', 'LGA', 'Unit', 'Currency'];
    const csvRows = [headers.join(',')];

    data.forEach(item => {
        const row = [
            `"${item.foodItem || ''}"`,
            `"${item.state || ''}"`,
            `"${item.region || ''}"`,
            item.price || 0,
            `"${item.availability || ''}"`,
            `"${item.date || ''}"`,
            `"${item.lga || ''}"`,
            `"${item.unit || ''}"`,
            `"${item.currency || ''}"`
        ];
        csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    csvButton.setAttribute('href', url);
    csvButton.setAttribute('download', 'food_prices.csv');
}

async function initDashboardPage() {
    showLoading(true);
    try {
        const years = await fetchData('/api/years');
        const yearFilter = document.getElementById('yearFilter');
        if (yearFilter) {
            yearFilter.innerHTML = '<option value="all">All Years</option>';
            years.forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearFilter.appendChild(option);
            });
        }

        const metrics = await fetchData(`/api/dashboard-metrics${yearFilter ? '?year=' + yearFilter.value : ''}`);
        document.getElementById('foodItems').textContent = metrics.foodItems;
        document.getElementById('regions').textContent = metrics.markets;
        document.getElementById('avgPrice').textContent = `₦${metrics.avgPrice.toLocaleString('en-NG')}`;
        document.getElementById('highestPrice').textContent = `${metrics.highestPrice.item}: ₦${metrics.highestPrice.price.toLocaleString('en-NG')} (${metrics.highestPrice.market})`;
        document.getElementById('lowestPrice').textContent = `${metrics.lowestPrice.item} (${metrics.lowestPrice.market}): ₦${metrics.lowestPrice.price.toLocaleString('en-NG')}`;
        document.getElementById('mostAvailable').textContent = metrics.mostAvailable;

        const topPrices = await fetchData(`/api/top-prices${yearFilter ? '?year=' + yearFilter.value : ''}`);
        const summaryTableBody = document.querySelector('#summaryTable tbody');
        summaryTableBody.innerHTML = ''; // Clear existing rows
        topPrices.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.foodItem || 'N/A'}</td>
                <td>${item.market || 'N/A'}</td>
                <td>₦${item.price.toLocaleString('en-NG')}</td>
                <td>${item.availability || 'N/A'}</td>
            `;
            summaryTableBody.appendChild(row);
        });

        const analytics = await fetchData('/api/analytics');
        const stateChart = document.getElementById('regionChart').getContext('2d');
        new Chart(stateChart, {
            type: 'bar',
            data: {
                labels: Object.keys(analytics.averagePricesByState),
                datasets: [{
                    label: 'Average Price (NGN)',
                    data: Object.values(analytics.averagePricesByState),
                    backgroundColor: '#4CAF50'
                }]
            },
            options: {
                scales: { y: { beginAtZero: true, title: { display: true, text: 'Price (NGN)' } } },
                plugins: { legend: { display: false } }
            }
        });
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        alert('Failed to load dashboard data. Please try again later.');
    } finally {
        showLoading(false);
    }
}

async function initAnalyticsPage() {
    showLoading(true);
    try {
        const years = await fetchData('/api/years');
        const yearFilter = document.getElementById('yearFilter');
        if (yearFilter) {
            yearFilter.innerHTML = '<option value="all">All Years</option>';
            years.forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearFilter.appendChild(option);
            });
        }

        const states = await fetchData('/api/states');
        const stateFilter = document.getElementById('stateFilter');
        if (!stateFilter) {
            console.error('State filter element not found');
            return;
        }
        stateFilter.innerHTML = '<option value="all">All States</option>';
        states.forEach(state => {
            const option = document.createElement('option');
            option.value = state.toLowerCase();
            option.textContent = state;
            stateFilter.appendChild(option);
        });

        const markets = await fetchData('/api/markets');
        const regionFilter = document.getElementById('regionFilter');
        if (!regionFilter) {
            console.error('Region filter element not found');
            return;
        }
        regionFilter.innerHTML = '<option value="all">All Markets</option>';
        markets.forEach(market => {
            const option = document.createElement('option');
            option.value = market.toLowerCase();
            option.textContent = market;
            regionFilter.appendChild(option);
        });

        const foods = await fetchData('/api/foods');
        const foodFilter = document.getElementById('foodFilter');
        if (!foodFilter) {
            console.error('Food filter element not found');
            return;
        }
        foodFilter.innerHTML = '<option value="all">All Foods</option>';
        foods.forEach(food => {
            const option = document.createElement('option');
            option.value = food.toLowerCase();
            option.textContent = food;
            foodFilter.appendChild(option);
        });

        await loadAnalyticsTable(1);
        await loadAnalyticsChart();
    } catch (error) {
        console.error('Error initializing analytics:', error);
        const tableBody = document.querySelector('#analyticsTable tbody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="2" class="text-center">No data available</td></tr>';
        }
    } finally {
        showLoading(false);
    }
}

async function loadAnalyticsTable(page = 1) {
    const stateFilter = document.getElementById('stateFilter');
    const regionFilter = document.getElementById('regionFilter');
    const foodFilter = document.getElementById('foodFilter');
    const yearFilter = document.getElementById('yearFilter');

    if (!stateFilter || !regionFilter || !foodFilter || !yearFilter) {
        console.error('Filter elements missing');
        return;
    }

    const state = stateFilter.value.toLowerCase();
    const market = regionFilter.value.toLowerCase();
    const food = foodFilter.value.toLowerCase();
    const year = yearFilter.value;

    const params = new URLSearchParams({ state, market, food_item: food, year, page: page, per_page: 20 });
    let response;
    try {
        response = await fetchData(`/api/analytics?${params}`);
    } catch (error) {
        console.error('Failed to fetch analytics data:', error);
        return;
    }

    const tableBody = document.querySelector('#analyticsTable tbody');
    if (!tableBody) {
        console.error('Analytics table body not found');
        return;
    }
    tableBody.innerHTML = '';

    if (!response.averagePricesByState || Object.keys(response.averagePricesByState).length === 0) {
        tableBody.innerHTML = '<tr><td colspan="2" class="text-center">No data available</td></tr>';
        renderPagination(1, 0, loadAnalyticsTable);
    } else {
        for (const [state, avgPrice] of Object.entries(response.averagePricesByState)) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${state}</td>
                <td>₦${avgPrice.toLocaleString('en-NG')}</td>
            `;
            tableBody.appendChild(row);
        }
        renderPagination(response.current_page, response.total_pages, loadAnalyticsTable);
    }
    clearNoDataWarnings();
}

async function loadAnalyticsChart() {
    const stateFilter = document.getElementById('stateFilter');
    const regionFilter = document.getElementById('regionFilter');
    const foodFilter = document.getElementById('foodFilter');
    const yearFilter = document.getElementById('yearFilter');
    const chartType = document.getElementById('chartType');

    if (!stateFilter || !regionFilter || !foodFilter || !yearFilter || !chartType) {
        console.error('Filter elements missing');
        return;
    }

    const state = stateFilter.value.toLowerCase();
    const market = regionFilter.value.toLowerCase();
    const food = foodFilter.value.toLowerCase();
    const year = yearFilter.value;
    const type = chartType.value;

    const params = new URLSearchParams({ state, market, food_item: food, year });
    let response;
    try {
        response = await fetchData(`/api/analytics?${params}`);
    } catch (error) {
        console.error('Failed to fetch analytics data:', error);
        return;
    }

    const chartCanvas = document.getElementById('priceChart').getContext('2d');
    const existingChart = Chart.getChart(chartCanvas);
    if (existingChart) {
        existingChart.destroy();
    }

    const chartData = response.averagePricesByState;
    new Chart(chartCanvas, {
        type: type,
        data: {
            labels: Object.keys(chartData),
            datasets: [{
                label: 'Average Price (NGN)',
                data: Object.values(chartData),
                backgroundColor: type === 'bar' ? '#4CAF50' :
                               type === 'pie' ? ['#4CAF50', '#FF9800', '#2196F3', '#9C27B0', '#F44336'] :
                               'rgba(76, 175, 80, 0.5)',
                borderColor: type === 'line' ? '#4CAF50' : undefined,
                borderWidth: type === 'line' ? 2 : 0,
                fill: type === 'line' ? true : false
            }]
        },
        options: {
            scales: type !== 'pie' ? { y: { beginAtZero: true, title: { display: true, text: 'Price (NGN)' } } } : {},
            plugins: { legend: { display: type === 'pie' } }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('priceTable')) {
        initPricesPage();
        ['stateFilter', 'regionFilter', 'foodFilter', 'yearFilter', 'sortBy'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => loadPriceTable(1));
            } else {
                console.warn(`Element with id ${id} not found`);
            }
        });
    } else if (document.getElementById('summaryTable')) {
        initDashboardPage();
        const yearFilter = document.getElementById('yearFilter');
        if (yearFilter) {
            yearFilter.addEventListener('change', () => initDashboardPage());
        }
    } else if (document.getElementById('analyticsTable')) {
        initAnalyticsPage();
        ['stateFilter', 'regionFilter', 'foodFilter', 'yearFilter', 'chartType'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    loadAnalyticsTable(1);
                    loadAnalyticsChart();
                });
            }
        });
    }
});