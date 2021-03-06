'use strict';

var DelegateMonitor = function ($scope, forgingMonitor) {
    this.updateActive = function (active) {
        _.each(active.delegates, function (d) {
            d.forgingStatus = forgingMonitor.getStatus(d);
        });
        $scope.activeDelegates = active.delegates;
        updateForgingTotals(active.delegates);
        updateForgingProgress($scope.forgingTotals);
    };

    this.updateTotals = function (active) {
        $scope.totalDelegates = active.totalCount || 0;
        $scope.totalActive    = 101;

        if ($scope.totalDelegates > $scope.totalActive) {
            $scope.totalStandby = ($scope.totalDelegates - $scope.totalActive);
        } else {
            $scope.totalStandby = 0;
        }

        $scope.bestForger  = bestForger(active.delegates);
        $scope.totalForged = totalForged(active.delegates);
        $scope.bestUptime  = bestUptime(active.delegates);
        $scope.worstUptime = worstUptime(active.delegates);
    };

    this.updateLastBlock = function (lastBlock) {
        $scope.lastBlock = lastBlock.block;
    };

    this.updateRegistrations = function (registrations) {
        $scope.registrations = registrations.transactions;
    };

    this.updateVotes = function (votes) {
        $scope.votes = votes.transactions;
    };

    this.updateLastBlocks = function (delegate) {
        var existing = _.find($scope.activeDelegates, function (d) {
            return d.publicKey === delegate.publicKey;
        });
        if (existing) {
            existing.blocksAt = delegate.blocksAt;
            existing.blocks = delegate.blocks;
            existing.forgingStatus = forgingMonitor.getStatus(delegate);
            updateForgingTotals($scope.activeDelegates);
            updateForgingProgress($scope.forgingTotals);
        }
    };

    // Private

    var bestForger = function (delegates) {
        if (_.size(delegates) > 0) {
            return _.max(delegates, function (d) { return d.fees; });
        }
    };

    var totalForged = function (delegates) {
        return _.chain(delegates)
                .map(function (d) { return d.fees; })
                .reduce(function (memo, num) { return memo + num; }, 0)
                .value();
    };

    var bestUptime = function (delegates) {
        if (_.size(delegates) > 0) {
            return _.max(delegates, function (d) { return parseFloat(d.productivity); });
        }
    };

    var worstUptime = function (delegates) {
        if (_.size(delegates) > 0) {
            return _.min(delegates, function (d) { return parseFloat(d.productivity); });
        }
    };

    var updateForgingTotals = function (delegates) {
        $scope.forgingTotals = forgingMonitor.getforgingTotals(delegates);
    };

    var updateForgingProgress = function (totals) {
        totals.processed = forgingMonitor.getForgingProgress(totals);

        if (totals.processed > 0) {
            $scope.forgingProgress = true;
        }
    };
};

angular.module('cryptichain.tools').factory('delegateMonitor',
  function ($socket, forgingMonitor) {
      return function ($scope) {
          var delegateMonitor = new DelegateMonitor($scope, forgingMonitor),
              ns = $socket('/delegateMonitor');

          ns.on('data', function (res) {
              if (res.active) {
                  delegateMonitor.updateActive(res.active);
                  delegateMonitor.updateTotals(res.active);
              }
              if (res.lastBlock) { delegateMonitor.updateLastBlock(res.lastBlock); }
              if (res.registrations) { delegateMonitor.updateRegistrations(res.registrations); }
              if (res.votes) { delegateMonitor.updateVotes(res.votes); }
          });

          ns.on('delegate', function (res) {
              if (res.publicKey) {
                  delegateMonitor.updateLastBlocks(res);
              }
          });

          $scope.$on('$destroy', function (event) {
              ns.removeAllListeners();
          });

          $scope.$on('$locationChangeStart', function (event, next, current) {
              ns.emit('forceDisconnect');
          });

          return delegateMonitor;
      };
  });
