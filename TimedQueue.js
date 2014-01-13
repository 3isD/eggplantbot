var TimedQueue = function(defaultDelay){
    this.queue = [];
    this.index = 0;
    this.defaultDelay = defaultDelay || 3000;
};

TimedQueue.prototype = {
    add: function(fn, delay){
        this.queue.push({
            fn: fn,
            delay: delay
        });
    },
    run: function(index){
        (index || index === 0) && (this.index = index);
        this.next();
    },
    next: function(){
        var self = this
        , i = this.index++
        , at = this.queue[i]
        , next = this.queue[this.index]
        if(!at) return;
        at.fn();
        next && setTimeout(function(){
            self.next();
        }, next.delay||this.defaultDelay);
    },
    reset: function(){
        this.index = 0;
    }
}

