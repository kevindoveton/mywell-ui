"use strict";
angular.module('controller.map-detail', ['nvd3'])
.controller('MapDetailController', function($scope, $state, ApiService, $stateParams) {

  $scope.$on('$ionicView.enter', function(e) {

  });

  $scope.resourceId = $stateParams.resourceId;
  $scope.stats = null;
  let detailChart = null;
  let allWeeklyReadings = [];
  let splitWeeklyReadings = []; //all weekly readings split per year
  let weeks = [];

  const getChartDataAndLabel = (dataRange) => {
    let dataAndLabel = {
      data: [],
      labels: null
    };

    switch (dataRange) {
      case 'month':
        dataAndLabel.data[0] = splitWeeklyReadings[0].slice(1).slice(-4);
        dataAndLabel.data[1] = splitWeeklyReadings[1].slice(1).slice(-4);
        dataAndLabel.data[2] = splitWeeklyReadings[2].slice(1).slice(-4);
        dataAndLabel.labels = weeks.slice(-4).map(dateTime => moment(dateTime).format('DD-MMM'));
        break;
      case '3month':
        dataAndLabel.data[0] = splitWeeklyReadings[0].slice(1).slice(-4 * 3);
        dataAndLabel.data[1] = splitWeeklyReadings[1].slice(1).slice(-4 * 3);
        dataAndLabel.data[2] = splitWeeklyReadings[2].slice(1).slice(-4 * 3);
        dataAndLabel.labels = weeks.slice(-4 * 3).map(dateTime => moment(dateTime).format('DD-MMM'));
        break;
      case 'year':
        dataAndLabel.data[0] = splitWeeklyReadings[0].slice(1).slice(-52);
        dataAndLabel.data[1] = splitWeeklyReadings[1].slice(1).slice(-52);
        dataAndLabel.data[2] = splitWeeklyReadings[2].slice(1).slice(-52);
        dataAndLabel.labels = weeks.slice(-52).map(dateTime => moment(dateTime).format('DD-MMM'));
        break;
      default:
        throw new Error(`dataRange ${dataRange} not found`);
    }

    return dataAndLabel;
  }

  const setupChart = () => {
    const colors = [
      {border:'rgba(54, 162, 235, 1)',background:'rgba(54, 162, 235, 0.2)'},
      {border:'rgba(153, 102, 255, 1)', background:'rgba(153, 102, 255, 0.2)'},
      {border:'rgba(255, 159, 64, 1)',background:'rgba(255, 159, 64, 0.2)'}
    ]

    let chartData = getChartDataAndLabel("month");
    const ctx = document.getElementById("detailChart");
    detailChart = new Chart(ctx, {
      type: 'line',
      data: {
          labels: chartData.labels,
          datasets: [
          {
            label: 'This year',
            data: chartData.data[0],
            borderWidth: 1,
            backgroundColor: colors[0].background,
            borderColor: colors[0].border,
            fill: 'bottom'
          },
          {
            label: 'Last Year',
            data: chartData.data[1],
            borderWidth: 1,
            backgroundColor: colors[1].background,
            borderColor: colors[1].border,
            fill: 'bottom'
          },
          {
            label: '2 years ago',
            data: chartData.data[2],
            borderWidth: 1,
            backgroundColor: colors[2].background,
            borderColor: colors[2].border,
            fill: 'bottom'
          }
        ]
      },
      options: {
        title: {
            display: true,
            text: 'Depth to Water Level (m)'
        },
        spanGaps: false,
        scales: {
          // reverse: true,
          yAxes: [{
            ticks: {
              beginAtZero:true,
              reverse:true
            }
          }]
        }
      }
    });
  }

  function init() {
    setupData();
  }

  $scope.updateData = (dataRange) => {
    const chartData = getChartDataAndLabel(dataRange);

    detailChart.data.datasets[0].data = chartData.data[0];
    detailChart.data.datasets[1].data = chartData.data[1];
    detailChart.data.datasets[2].data = chartData.data[2];
    detailChart.data.labels = chartData.labels;
    detailChart.update();
  }

  //Get the data from the api service
  console.log("Getting data from server");
  function setupData() {
    return Promise.all([
      // ApiService.getResourceReadings($stateParams.postcode, $scope.resourceId),
      ApiService.getReadingsByWeek($stateParams.postcode, $scope.resourceId),
      ApiService.getDifferenceFromJune(null, 'individual', $scope.resourceId, $stateParams.postcode)
        .catch(err => console.log(err)),
      ApiService.getResource($stateParams.postcode, $scope.resourceId),
      ApiService.getCurrentVillageAverage($stateParams.postcode, $scope.resourceId)
    ])
    .then(results => {
      const readingsByWeek = results[0].data;
      allWeeklyReadings = readingsByWeek.readings;
      weeks = readingsByWeek.weeks;

      let juneData = null;
      if (!angular.isNullOrUndefined(results[1]) && !angular.isNullOrUndefined(results[1].data)) {
        let pastReadingDate = new Date(results[1].data.pastReadingDate).toISOString().slice(0,10);
        let difference = `${results[1].data.difference.toFixed(2)} m`;
        juneData =  {
          pastReadingDate: pastReadingDate,
          difference: difference
        };
      }

      let readingValue = null;
      let percentageFull = null;
      if (!angular.isNullOrUndefined(results[2]) && !angular.isNullOrUndefined(results[2].data)) {
        //TODO: check if we are a rain_gauge or checkdam
        const reading = results[2].data;
        $scope.resource = reading;
        readingValue = reading.last_value.toFixed(2);
        percentageFull = ((reading.well_depth - reading.last_value) / reading.well_depth * 100).toFixed(2);
      }

      let villageAverageReading = null;
      if (!angular.isNullOrUndefined(results[3]) && !angular.isNullOrUndefined(results[3].data)) {
        villageAverageReading = results[3].data.avgReading;
      }

      if (!angular.isNullOrUndefined(readingValue) ||
          !angular.isNullOrUndefined(percentageFull) ||
          !angular.isNullOrUndefined(villageAverageReading) ||
          !angular.isNullOrUndefined(juneData)) {
          console.log("Setting up stats!");
        $scope.stats = {
          readingValue: readingValue,
          percentageFull: percentageFull,
          villageAverageReading: 10.11,
          juneData: juneData
        }
      }

      //Split into 3, one for each year
      const slicePoints = [0, 51, 103, allWeeklyReadings.length]
      splitWeeklyReadings = [
        allWeeklyReadings.slice(slicePoints[2], slicePoints[3]),//This year
        allWeeklyReadings.slice(slicePoints[1], slicePoints[2]),
        allWeeklyReadings.slice(slicePoints[0], slicePoints[1])
      ];

      setupChart();
      $scope.$apply();
      console.log("finished loading data etc.");
    })
    .catch(function(err) {
      console.log('Error setting up data', err);
    });
  }

  function saftelyGetLevelString(value) {
    if (angular.isNullOrUndefined(value)) {
      return "";
    }
    return value.toFixed(2);
  }

  init();
})
.filter('capitalize', function() {
    return function(input) {
      return (!!input) ? input.charAt(0).toUpperCase() + input.substr(1).toLowerCase() : '';
    }
});
