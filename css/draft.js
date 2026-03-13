var eventualSafeNodes = function(graph) {
    const terminalNodes = [];
    graph.forEach((x, i) => {
        if (x.length === 0) {
            terminalNodes.push(i);
        }
    });

    let len = 0;
    // console.log(terminalNodes)
    while (len !== terminalNodes.length) {
        // console.log(len, terminalNodes.length)
        len = terminalNodes.length;
        for (let x in graph) {
            if (graph[x].length===0 || terminalNodes.includes(+x)) {
                continue;
            }
            let flag = true;
            for (let a of graph[x]) {
                if (!terminalNodes.includes(a)) {
                    flag = false;
                    break;
                }
            }
            if (flag) {
                terminalNodes.push(+x);
            }
            // if (terminalNodes.length === 5) {
            //     break;
            // }
        }        
    }
    
    return terminalNodes.sort((a,b) => a-b);
};

console.log(eventualSafeNodes([[1,2],[2,3],[5],[0],[5],[],[]]))