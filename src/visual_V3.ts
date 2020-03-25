/*
Author: Om Prakash Sao
Date: 26th July 2019
Client: SHIFT Consulting
Comment: V3 = V2 + AngularAxis Tick Labels and Axis done.
*/

module powerbi.extensibility.visual {
    "use strict";
    interface Risk {
        /*parentLabel: string;
        angularAxis: string;
        radialAxis: string;*/
        /*angle: number;
        radius: number;
        size: number;
        label: string;*/
        parentLabel: string;
        angularAxis: string;
        radialAxis: string;
        bubbleSize: string;
        bubbleColor: string;
        bubbleLabel: string;
        //otherValues: string;
        
        factorized_angularAxis: number,
        factorized_radialAxis: number,
        factorized_bubbleColor: number,
        factorized_bubbleSize: number,
        n_points: number;
        angular_width: number;
        risk_per_angularField: number;
        x_partition: number;
        y_partition: number;
        x: number;
        y: number;
        angle: number;
    };

    interface ViewModel {
        riskBubbles: Risk[];
        outerMostRadius: number;
    };
    export class Visual implements IVisual {
        private host: IVisualHost;
        private svgContainer: d3.Selection<SVGElement>;
        private radialAxisGroup: d3.Selection<SVGElement>;
        private settings = {
            axis: {
                radialAxis: {
                    outerMostRadius: 5
                }
            }
        };
        private radialAxisTicksGroup : d3.Selection<SVGElement>;
        private radialAxis : d3.Selection<SVGElement>;
        private angularAxisGroup: d3.Selection<SVGElement>;
        private angularAxisTicksGroup: d3.Selection<SVGElement>;
        
        private angularAxisFactorLevels = null;
        
        
        private radialAxisTickLabelsArray = ["Latent", "Immediate / already impacting", "< 3 months", "> 3 months"];
        private radialAxisFactorLevels = ["Latent (may occure anytime) e.g., safety realted, geopolitical risks", "Immediate / already impacting", "< 3 months", "> 3 months"];
        
        private bubbleColorsFactorLevels = ["Leadership Attention Required", "Monitor / Periodic Review", "No Major Concerns / Risk Effectively Mitigated"];
        //["Monitor / Perioic Review", "No Major Concerns / Risk Effectively Mitigated", "Leadership Attention Required"]
        
        private bubbleSizesFactorLevels = ["Low", "Medium", "High", "Very High"];

        private totalNumberOfRisks = 0;
        private numberOfSectors = 0;

        private angularWidth_Array = [];
        private angularWeight_Array = [];
        private totalAngularWeight = 0;
        private cumulativeAngularWidth_Array = [];
        private angularTickLabels_angularPosition_Array = [];
        private riskPerAngularField = 0;

        private offset = 0.2
        private start_CoordinateRange_x = this.offset;
        private end_CoordinateRange_x = 1 - this.offset;
        private start_CoordinateRange_y = this.offset
        private end_CoordinateRange_y = 1 - this.offset;
        
        private bubble_colors_map = ["#FF0000", "#FFC000", "#00AC50"]; //c(rgb(255,0,0), rgb(255,192,0), rgb(0, 176,80)) ## RED/AMBER/GREEN  order. Text color: white/black/white order
        private sentinelChartTitle: string = null;
        private bubble_size_upperlimit_factor = 0; 
        private Bubble_bubbleSize_selection = 50;
        private lowSize = 0;
        private mediumSize = 0;
        private highSize = 0;
        private veryHighSize = 0;

        constructor(options: VisualConstructorOptions) {
            //console.log('Visual constructor', options);
            /*INITIAL SCAFFOLDING
            console.log('Visual constructor', options);
            this.target = options.element;
            this.updateCount = 0;
            if (typeof document !== "undefined") {
                const new_p: HTMLElement = document.createElement("p");
                new_p.appendChild(document.createTextNode("Update count:"));
                const new_em: HTMLElement = document.createElement("em");
                this.textNode = document.createTextNode(this.updateCount.toString());
                new_em.appendChild(this.textNode);
                new_p.appendChild(new_em);
                this.target.appendChild(new_p);
            }*/
            this.host = options.host;
            this.svgContainer = d3.select(options.element)
                .append("svg")
                .classed("svgContainerClass", true);
            //this.radialAxis = d3.select(options.element)
            this.radialAxisGroup = this.svgContainer
                .append("g")
                .classed("radialAxisGroupClass", true);

            this.radialAxisGroup.append("circle").classed("radialAxisCircle", true);
            this.radialAxisGroup.append("circle").classed("radialAxisCircle", true);
            this.radialAxisGroup.append("circle").classed("radialAxisCircle", true);
            this.radialAxisGroup.append("circle").classed("radialAxisCircle", true);
            this.radialAxisGroup.append("circle").classed("radialAxisCircle", true);

            this.radialAxisTicksGroup = this.svgContainer
                .append("g")
                .classed("radialAxisTickGroupClass", true)
                .attr({
                    transform: "rotate(0)" //SAFE: -90
                });
            this.radialAxisTicksGroup.append("text").classed("radialAxisTickClass", true);
            this.radialAxisTicksGroup.append("text").classed("radialAxisTickClass", true);
            this.radialAxisTicksGroup.append("text").classed("radialAxisTickClass", true);
            this.radialAxisTicksGroup.append("text").classed("radialAxisTickClass", true);

            this.radialAxis = this.svgContainer
                .append("g")
                .attr({
                    transform: "rotate(0)",

                })
                .append("line")
                .classed("radialAxisLine", true);  

            this.angularAxisGroup = this.svgContainer
                .append("g")
                .classed("angularAxisGroupClass", true);
            
            this.angularAxisTicksGroup = this.svgContainer
                .append("g")
                .classed("angularAxisTickGroupClass", true);

            /*this.start_CoordinateRange_x = this.offset;
            this.end_CoordinateRange_x = 1 - this.offset;
            this.start_CoordinateRange_y = this.offset;
            this.end_CoordinateRange_y = 1 - this.offset;*/
            
        }

        public update(options: VisualUpdateOptions) {
            console.log("****UPDATE FUNCTION CALLED****");
            console.log('Visual update', options);
            /*INITIAL SCAFFOLDING 
            this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);
            console.log('Visual update', options);
            if (typeof this.textNode !== "undefined") {
                this.textNode.textContent = (this.updateCount++).toString();
            }*/
            
            //this.svgContainer.empty(); returns boolean if empty or not.
            //this.radialAxisGroup.selectAll(".radialAxisClass").remove;
            //console.log("****REMOVED?****", this.svgContainer.selectAll(".radialAxisClass").empty());
            //WASTE: this.svgContainer.append("g").classed("radialAxisGroupClass", true);

            /*let sample: Risk[] = [
                {
                    angle: this.reMap(25),
                    radius: 0.9,
                    size: 10,
                    label: "label 1(25)"
                },
                {
                    angle: this.reMap(105),
                    radius: 0.7,
                    size: 10,
                    label: "label 2(105)"
                }
            ];

            console.log("sample:==>", sample);

            let viewModel: ViewModel = {
                riskBubbles: sample,
                outerMostRadius: this.settings.axis.radialAxis.outerMostRadius
            }*/

            //////=======START: DATA WRANGLING:======\\\\\\\////////

            let viewModel = this.getViewModel(options);
            console.log("^^^^viewModel fetched^^^^", viewModel);

            console.log("^^^getUnique: radialAxis^^^", typeof(this.getUnique("radialAxis", viewModel)), this.getUnique("radialAxis", viewModel) );
            console.log("^^^getUnique: angularAxis^^^", typeof(this.getUnique("angularAxis", viewModel)), this.getUnique("angularAxis", viewModel));
            console.log("^^^getUnique: bubbleColor^^^", typeof(this.getUnique("bubbleColor", viewModel)), this.getUnique("bubbleColor", viewModel));
            
            this.angularAxisFactorLevels = this.getUnique("angularAxis", viewModel);
            this.radialAxisFactorLevels = ["Latent (may occure anytime) e.g., safety realted, geopolitical risks", "Immediate / already impacting", "< 3 months", "> 3 months"];
            this.sentinelChartTitle = String(this.getUnique("parentLabel", viewModel)); // paste("", paste(levels(risk_register_data$parentLabel), collapse = ", "))

            this.totalNumberOfRisks = viewModel.riskBubbles.length;
            this.numberOfSectors = this.angularAxisFactorLevels.length;

            this.bubble_size_upperlimit_factor = (0.6 + (0.4 * 6 * this.Bubble_bubbleSize_selection)/(this.numberOfSectors * 50)) //#default value Bubble_bubbleSize_selection = 50

            this.lowSize <- 8 * this.bubble_size_upperlimit_factor
            this.mediumSize <- 12 * this.bubble_size_upperlimit_factor
            this.highSize <- 16 * this.bubble_size_upperlimit_factor
            this.veryHighSize <- 24 * this.bubble_size_upperlimit_factor

            this.angularWidth_Array = [];  //size: number of angular sectors
            this.angularWeight_Array = [];  //size: number of angular sectors
            this.totalAngularWeight = 0;  
            this.cumulativeAngularWidth_Array = []; //size: number of angular sectors
            this.angularTickLabels_angularPosition_Array = []; //size: number of angular tick labels
            this.riskPerAngularField = 0;

            //Below 4 factorizeColumn(..) calls are call by reference. Hence, changes viewModel persistently.
            this.factorizeColumn("angularAxis", viewModel, null); //radialAxisFactorLevels
            this.factorizeColumn("radialAxis", viewModel, this.radialAxisFactorLevels); 
            this.factorizeColumn("bubbleColor", viewModel, this.bubbleColorsFactorLevels); 
            this.factorizeColumn("bubbleSize", viewModel, this.bubbleSizesFactorLevels); 



            for (let angularAxisFactorItem_index in this.angularAxisFactorLevels){ //angularAxisFactorItem_index is number
                
                let currentAngularAxisName = this.angularAxisFactorLevels[angularAxisFactorItem_index];
                console.log("**", angularAxisFactorItem_index, currentAngularAxisName);
                this.angularWeight_Array[angularAxisFactorItem_index] = 3 * viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.factorized_radialAxis == 1; }).length
                                                + 2 * viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.factorized_radialAxis == 2; }).length
                                                + 1 * viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.factorized_radialAxis == 3; }).length
                                                + 1 * viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.factorized_radialAxis == 4; }).length
                                                ;
            }

            this.totalAngularWeight = this.angularWeight_Array.reduce(function getSum(total, value, index, array){ return total + value});  //https://www.w3schools.com/js/tryit.asp?filename=tryjs_es5_array_reduce
            
            //once totalAngularWeight is calculated, now calculate the angularWidth_Array
            for (let angularAxisFactorItem_index in this.angularAxisFactorLevels){ // 0-based angularAxisFactorItem_index is number in string type
                let currentAngularAxisName = this.angularAxisFactorLevels[angularAxisFactorItem_index];
                
                console.log("***", angularAxisFactorItem_index, this.angularWeight_Array[angularAxisFactorItem_index], this.totalAngularWeight );
                this.angularWidth_Array.push(Math.floor( (360 *  this.angularWeight_Array[angularAxisFactorItem_index] )/ this.totalAngularWeight ));
            }

            for (let angularAxisFactorItem_index in this.angularAxisFactorLevels){ //0-based angularAxisFactorItem_index is number in string type
                if(angularAxisFactorItem_index == "0"){
                    this.cumulativeAngularWidth_Array[angularAxisFactorItem_index] = 0;
                    this.angularTickLabels_angularPosition_Array[angularAxisFactorItem_index] = Math.floor(this.angularWidth_Array[angularAxisFactorItem_index] / 2 );
                }
                else{
                    this.cumulativeAngularWidth_Array[angularAxisFactorItem_index] = Math.floor(this.angularWidth_Array[parseInt(angularAxisFactorItem_index) - 1] + this.cumulativeAngularWidth_Array[parseInt(angularAxisFactorItem_index) -1] );
                    this.angularTickLabels_angularPosition_Array[angularAxisFactorItem_index] = Math.floor(this.angularWidth_Array[parseInt(angularAxisFactorItem_index)]/2) + Math.floor(this.cumulativeAngularWidth_Array[parseInt(angularAxisFactorItem_index)] );
                }
            }

            console.log("&&angularWeight_Array", this.angularWeight_Array, "&&totalAngularWeight", this.totalAngularWeight);
            console.log("&&angularWidth_Array", this.angularWidth_Array);
            console.log("&&cumulativeAngularWidth_Array", this.cumulativeAngularWidth_Array);
            console.log("&&angularTickLabels_angularPosition_Array", this.angularTickLabels_angularPosition_Array);            

            console.log("FROM OUTSIDE", viewModel);

            this.start_CoordinateRange_x = this.offset;
            this.end_CoordinateRange_x = 1 - this.offset;
            this.start_CoordinateRange_y = this.offset;
            this.end_CoordinateRange_y = 1 - this.offset;
            let n_points: number = 0, x_partition: number = 0, y_partition: number = 0, each_split: number = 0;

            let x_vector_data: Array<number> = [];
            let y_vector_data: Array<number> = [];


            for (let angularAxisFactorItem_index in this.angularAxisFactorLevels){ //0-based angularAxisFactorItem_index is number in string type: "0", "1", "2", "3", ..
                for (let radialAxisFactorItem_index in this.radialAxisFactorLevels){ //0-based radialAxisFactorItem_index is number in string type: "0", "1", "2", "3", ..
                    
                    let currentAngularAxisName = this.angularAxisFactorLevels[angularAxisFactorItem_index];
                    let currentRadialAxisName = this.radialAxisFactorLevels[radialAxisFactorItem_index];
                    this.riskPerAngularField = viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName; }).length;
                    //console.log("%%", angularAxisFactorItem_index,"**", radialAxisFactorItem_index, "**", currentAngularAxisName, "**", currentRadialAxisName);

                    if( this.riskPerAngularField/this.totalNumberOfRisks > 2/6){  //CASE: Large amount(1/3rd of total) of risk are on that particular angular sector. So plot risks till the edge
                        this.offset = 0.05
                        this.start_CoordinateRange_x = this.offset;
                        this.end_CoordinateRange_x = 1 - this.offset;
                      }
                      else if( this.riskPerAngularField/this.totalNumberOfRisks > 1/6){
                        this.offset = 0.1
                        this.start_CoordinateRange_x = this.offset;
                        this.end_CoordinateRange_x = 1 - this.offset;
                      }
                      else{
                        this.offset = 0.2
                        this.start_CoordinateRange_x = this.offset;
                        this.end_CoordinateRange_x = 1 - this.offset;
                      }

                    n_points = viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; }).length
                    if(n_points != 0){
                        x_partition = Math.ceil(Math.sqrt( n_points ));    
                        y_partition = Math.ceil( (n_points + 1)/x_partition );
                    }
                    else{
                        x_partition = 0;
                        y_partition = 0;
                    }

                    //console.log("%%", angularAxisFactorItem_index,"**", radialAxisFactorItem_index, "**", currentAngularAxisName, "**", currentRadialAxisName);
                    //console.log("%%", this.offset, "**", "n_points:==>", n_points, "x_partition:==>", x_partition, "y_partition:==>", y_partition);

                    for (let index in viewModel.riskBubbles){ //0-based index is number in string type: "0", "1", "2", "3", ..
                        //console.log("index in viewModel.riskBubble:==>", index);
                        if(viewModel.riskBubbles[index].angularAxis == currentAngularAxisName && viewModel.riskBubbles[index].radialAxis == currentRadialAxisName){
                            viewModel.riskBubbles[index].n_points = n_points;
                            viewModel.riskBubbles[index].risk_per_angularField = this.riskPerAngularField;
                            viewModel.riskBubbles[index].angular_width = Math.floor( (360 *  this.angularWeight_Array[angularAxisFactorItem_index] )/ this.totalAngularWeight );
                            viewModel.riskBubbles[index].x_partition = x_partition;
                            viewModel.riskBubbles[index].y_partition = y_partition;
                        }
                    }
                    
                    if(x_partition == 1){
                        each_split = (this.end_CoordinateRange_x - this.start_CoordinateRange_x)/1;
                        //each_split.toFixed(2);
                    }
                    else if(x_partition > 1){
                        each_split = (this.end_CoordinateRange_x - this.start_CoordinateRange_x)/(x_partition - 1);
                        //each_split.toFixed(2);
                    }
                    //console.log("each_split:==>", each_split, "start_x", this.start_CoordinateRange_x, "end_x", this.end_CoordinateRange_x);

                    if(x_partition > 0){
                        if(x_partition == 1){
                            x_vector_data = [0.5, 0.5];
                        }
                        else{
                        //x_vector_data <- rep(c(seq(start_CoordinateRange_x, end_CoordinateRange_x, length.out = x_partition), c(seq(start_CoordinateRange_x + each_split/2, end_CoordinateRange_x - each_split/2, length.out = x_partition - 1)  )  ), times = ceiling(y_partition/2 )) 
                        x_vector_data =  this.repeatArray( this.seq(this.start_CoordinateRange_x, this.end_CoordinateRange_x, x_partition).concat(this.seq(this.start_CoordinateRange_x + each_split/2, this.end_CoordinateRange_x - each_split/2, x_partition -1) ), Math.ceil(y_partition/2)  );// this.repeatArray( this.seq(this.start_CoordinateRange_x, this.end_CoordinateRange_x, x_partition).concat(this.seq(this.start_CoordinateRange_x + each_split/2, this.end_CoordinateRange_x - each_split/2, x_partition - 1))  )  ), times = ceiling(y_partition/2 )) 
                        
                        }

                        let y_vector: Array<number> = this.seq(this.end_CoordinateRange_y, this.start_CoordinateRange_y, y_partition) // y vector data revsersed so that bubbles plotting starts from away to the center to toward the center. It helps in reducing overlap.
                        y_vector_data = []  //Initialize with empty array.
                        for(let i:number = 1; i <= y_partition; i++){
                            //SAFE: y_vector_data <- c(y_vector_data, rep(y_vector[i], times = x_partition))
                            if(i % 2 == 1){
                              y_vector_data = y_vector_data.concat( this.repeatArray([y_vector[i-1]], x_partition));
                            }
                            else
                            {
                              y_vector_data = y_vector_data.concat( this.repeatArray([y_vector[i-1]], x_partition - 1) ) //rep(y_vector[i], times = x_partition - 1))
                            }
                          }
                    }
                    
                    if(n_points == 2)
                    {
                        x_vector_data = [0.5, 0.5]
                        y_vector_data = [this.start_CoordinateRange_y, this.end_CoordinateRange_y]
                    }

                    //console.log("x_vector_data:==>", x_vector_data, "y_vector_data:==>", y_vector_data);

                    let number_of_bubbles_in_angular_sector = viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName  } ).length;  //nrow(risk_register_data[risk_register_data$angularAxis == angular_item , ] )
                    let number_of_bubbles_in_full_row = y_vector_data.indexOf(Math.min.apply(null, y_vector_data)); // https://stackoverflow.com/questions/1669190/find-the-min-max-element-of-an-array-in-javascript //match(min(y_vector_data), y_vector_data) - 1 //SAFE: match(0.2, vector) gives index of first 0.2 found.
                    let number_of_bubbles_in_last_row = n_points - number_of_bubbles_in_full_row
                    let improved_x_vector_data = null;

                    //console.log("number_of_bubbles_in_angular_sector:==>",number_of_bubbles_in_angular_sector, "number_of_bubbles_in_full_row:==>", number_of_bubbles_in_full_row, "number_of_bubbles_in_last_row:==>", number_of_bubbles_in_last_row);
                    
                    if(number_of_bubbles_in_last_row > 0 && number_of_bubbles_in_last_row < 2){ //number_of_bubbles_in_angular_sector < 10)
                        improved_x_vector_data = x_vector_data.slice(0, number_of_bubbles_in_full_row).concat( this.seq(this.start_CoordinateRange_x, this.end_CoordinateRange_x, number_of_bubbles_in_last_row + 2).slice(1, number_of_bubbles_in_last_row + 1) );  //c(x_vector_data[1:number_of_bubbles_in_full_row], seq(start_CoordinateRange_x, end_CoordinateRange_x, length.out = number_of_bubbles_in_last_row + 2)[-c(1, number_of_bubbles_in_last_row + 2)]  )
                    }
                    else{
                        improved_x_vector_data = x_vector_data
                    }

                    //console.log("improved_x_vector_data:==>", improved_x_vector_data);
                    for(let i:number = 0; i < n_points; i++){ //  in 1:nrow(risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, ] )) {
                        //risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "x"][i] <- improved_x_vector_data[i] + risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "angularAxis"][i] - 1.0  #- 0.5
                        viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; })[i].x = improved_x_vector_data[i] + viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; })[i].factorized_angularAxis - 1.0;
                        //risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "y"][i] <- y_vector_data[i] + risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "radialAxis"][i] #-0.5
                        viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; })[i].y = y_vector_data[i] + viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; })[i].factorized_radialAxis;
                        //#SAFE: risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "angle"][i] <- as.integer( (x_vector_data[i] + risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "angularAxis"][i] - 1.0)*(360/number_of_sectors) ) 
                        //risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "angle"][i] <- as.integer( (improved_x_vector_data[i])* as.integer(angularWidth_list[as.integer(angular_item)]) + as.integer(cumulative_angularWidth_list[as.integer(angular_item)])) 
                        viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; })[i].angle = ( (improved_x_vector_data[i]) * parseInt(this.angularWidth_Array[parseInt(angularAxisFactorItem_index)]) + parseInt(this.cumulativeAngularWidth_Array[parseInt(angularAxisFactorItem_index)])); //y_vector_data[i] + viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; })[i].factorized_radialAxis;
                    }
                    
                    console.log(">>>>>>>>>>>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<<<")
                    
                }
            }
            //////=======END: DATA WRANGLING:======\\\\\\\////////



            console.log("**viewModel:==>", viewModel);
            console.log("**this.sentinelChartTitle", this.sentinelChartTitle);
            console.log("**this.angularTickLabels_angularPosition_Array:==>", this.angularTickLabels_angularPosition_Array);
            console.log("**this.angularWidth_Array:==>", this.angularWidth_Array);
            console.log("**this.cumulativeAngularWidth_Array:==>", this.cumulativeAngularWidth_Array);

            //console.log(this.repeatArray([1,2,3,4], 3));
            //console.log(this.seq(0, 1, 1));
            //console.log(this.seq(0, 1, 2));
            //console.log("DEBUG:#319", this.seq(0, 1, 3));
            //console.log("DEBUG:#320",this.seq(0, 1, 4));

            //////=======START: CHART PLOTTING:======\\\\\\\////////

            let width = options.viewport.width;
            let height = options.viewport.height;

            let outerMostRadialAxisRadius = Math.min(width, height) / 2 - 50; // radius of the whole chart //SAFE: -30
            //let outerMostRadialAxisRadius = Math.min(options.viewport.width, options.viewport.height) / 2 - 50; // radius of the whole chart //SAFE: -30

            this.svgContainer
            .style("background-color", "azure")
            .attr({
                width: width,
                height: height,
                "outerRadiusDummy": outerMostRadialAxisRadius
            });

            let radialAxisScale = d3.scale.linear()
            .domain([0, 5])  //5 because total 5 concentric circles
            .range([0, outerMostRadialAxisRadius]);

            //let factorRadius = 50;
            //let radiusArray = [1 * factorRadius, 2 * factorRadius, 3 * factorRadius, 4 * factorRadius, 5 * factorRadius];
            //let radiusArray = [1, 2, 3, 4, 5];
            let radiusArray = [Math.floor(outerMostRadialAxisRadius * 1/5), Math.floor(outerMostRadialAxisRadius * 2/5), Math.floor(outerMostRadialAxisRadius * 3/5), Math.floor(outerMostRadialAxisRadius * 4/5), Math.floor(outerMostRadialAxisRadius * 5/5)];

            let radialAxisCircle = this.radialAxisGroup
                //.selectAll(".radialAxisCircle")
                //.remove()
                .selectAll(".radialAxisCircle") //.selectAll(".radialAxisCircle")
                //.data(viewModel.riskBubbles);
                .data(radiusArray);  //WORKING
                //.data(radialAxisScale);

            radialAxisCircle
                //.enter()
                //.append("circle")
                .classed("radialAxisCircle", true)
                //.style("fill", "grey")
                .style("fill-opacity", 0) //0.5
                .style("stroke", "grey")
                .style("stroke-width", 1)
                .attr({
                    //r: d => radialAxisScale(d),//outerMostRadialAxisRadius,
                    //r: d => radialAxisScale(d),
                    r: d => d,
                    cx: Math.floor(width / 2),
                    cy: Math.floor(height / 2)
                });

            radialAxisCircle.exit().remove();

            this.radialAxisTicksGroup
                .selectAll(".radialAxisTickClass")
                .data(this.radialAxisTickLabelsArray)
                //.enter()
                //.append("text")
                .style("fill", "red")
                .style("font-size", 20)
                .attr({
                    dx: "0.5em",
                    x: Math.floor(width / 2),
                    y: function(d, index){ return (Math.floor(height / 2) - radialAxisScale( index + 2) ); }
                })
                .text(function(d, index){ /*console.log("--", d, index);*/ return d;});

            this.radialAxis
                .data(this.radialAxisTickLabelsArray)
                .style("stroke", "grey")
                .style("stroke-width", 1.5)
                .attr({
                    x1: Math.floor(width / 2),
                    y1: function(d, index){ return Math.floor(height / 2) - radialAxisScale(1); },
                    x2: Math.floor(width / 2),
                    y2: Math.floor(height / 2) - outerMostRadialAxisRadius

                });

            this.angularAxisGroup
            //this.angularAxisTicksGroup
                .selectAll(".angularAxisLine")
                //.data(this.angularTickLabels_angularPosition_Array)
                .data(this.cumulativeAngularWidth_Array)
                //.style("font-size", 20)
                .enter()
                .append("g")
                .attr({
                    "transform": function(d, index){return 'rotate(' + 0 + ')';},
                })
                .append("line").classed("angularAxisLine", true)
                //.style("fill", "green")
                .style("stroke", "blue")
                .style("stroke-width", 1.5)
                .attr({
                    /*x1: Math.floor(width / 2) + radialAxisScale(1),
                    y1: Math.floor(height / 2), //function(d, index){ return Math.floor(height / 2) - radialAxisScale(1); },
                    x2: Math.floor(width / 2) + radialAxisScale(5),
                    y2: Math.floor(height / 2)
                    */
                   x1: function(d, index){ return Math.floor(width/2) + radialAxisScale(1) * Math.cos( (1 * Math.PI * (270 + d) )/180); },
                   y1: function(d, index){ return Math.floor(height/2) + radialAxisScale(1) * Math.sin( (1 * Math.PI * (270 + d))/180); },
                   x2: function(d, index){ return Math.floor(width/2) +  radialAxisScale(5) * Math.cos( (1 * Math.PI * (270 + d))/180); },
                   y2: function(d, index){ return Math.floor(height/2) +  radialAxisScale(5) * Math.sin( (1 * Math.PI * (270 + d))/180); },
                   dummyAngle: function(d, index){return d;}
                });

            this.angularAxisTicksGroup
                .selectAll(".angularAxisTicks")
                //.data(this.angularTickLabels_angularPosition_Array)
                .data(this.angularTickLabels_angularPosition_Array)
                //.style("font-size", 20)
                .enter()
                .append("g")
                .attr({
                    "transform": function(d, index){return 'rotate(' + 0 + ')';},
                })
                .append("text").classed("angularAxisTicks", true)
                .style("fill", "green")
                //.style("stroke", "blue")
                //.style("stroke-width", 1.5)
                //.style("text-anchor", function(d) { return d < 270 && d > 90 ? "end" : null; })
                .style("text-anchor", function(d) { return d > 200 && d < 360 ? "end" : "start"; })
                //.style("text-anchor", function(d) { return d > 160 && d <= 200 ? "middle" : "end"; })
                .attr({
                    /*x1: Math.floor(width / 2) + radialAxisScale(1),
                    y1: Math.floor(height / 2), //function(d, index){ return Math.floor(height / 2) - radialAxisScale(1); },
                    x2: Math.floor(width / 2) + radialAxisScale(5),
                    y2: Math.floor(height / 2)
                    */
                   //x1: function(d, index){ return Math.floor(width/2) + radialAxisScale(1) * Math.cos( (1 * Math.PI * (270 + d) )/180); },
                   //y1: function(d, index){ return Math.floor(height/2) + radialAxisScale(1) * Math.sin( (1 * Math.PI * (270 + d))/180); },
                   
                   //dx: "0.5em",
                   dx: function(d) { return d > 180 && d < 360 ? "-0.5em" : "0.5em"; },
                   dy: function(d) { return d > 135 && d <= 220 ? "1em" : "0em"; },
                   //dy: function(d) { return d > 180 && d < 360 ? "0.5em" : "0em"; },
                   x: function(d, index){ return Math.floor(width/2) +  radialAxisScale(5) * Math.cos( (1 * Math.PI * (270 + d))/180); },
                   y: function(d, index){ return Math.floor(height/2) +  radialAxisScale(5) * Math.sin( (1 * Math.PI * (270 + d))/180); },
                   dummyAngle: function(d, index){return d;}
                })
                //.text(function(d, index){ console.log("^^^", this.angularAxisFactorLevels[index]); return  this.angularAxisFactorLevels[index]; } );
                .text("Meow")
                ;


            //////=======END: CHART PLOTTING:======\\\\\\\////////


        }

        public reMap (oldValue: number): number{
            let oldMin = 0,
            oldMax = -359,
            newMin = 0,
            newMax = (Math.PI * 2),
            newValue = (((oldValue - 90 - oldMin) * (newMax - newMin)) / (oldMax - oldMin)) + newMin;
  
            return newValue;
        }

        public repeatArray(array: Array<any>, times: number): Array<any>{ //Call signuature: repeatArray([1,2,3,4], 3); will return: [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3]

            // Create an array of size "n" with undefined values
            var arrays = Array.apply(null, new Array(times)); 

            // Replace each "undefined" with our array, resulting in an array of n copies of our array
            arrays = arrays.map(function() { return array });

            // Flatten our array of arrays
            return [].concat.apply([], arrays);
        }

        public seq(start: number, end: number, length_out: number): Array<number>{//Call signature: seq(0, 1, 3): output: [0, 0.5, 1]
            if(length_out == 1){
                return [start];
            }
            else if(length_out == 2){
                return[start, end];
            }
            else{
                let step: number = (end - start)/(length_out - 1);
                let returnArray: Array<number> = [];
                for(let i = 0; i < length_out; i++){
                    returnArray[i] = parseFloat((start + (step) * i).toFixed(2));
                }
                return returnArray;
            }
        }

        public getUnique(columnName: string, viewModel: ViewModel): object{  //return type: Risk[]
            //return viewModel.riskBubbles.map(item => item[columnName].trim()).filter((value, index, self) => self.indexOf(value) === index);
            let factorsArray_ofRiskArrayType = viewModel.riskBubbles.map(item => item[columnName].trim()).filter((value, index, self) => self.indexOf(value) === index);
            let factorsArray = [];
            for(let i = 0; i < factorsArray_ofRiskArrayType.length; i++){
                factorsArray.push(factorsArray_ofRiskArrayType[i]);
            }
            return factorsArray;
        }

        //factorizeColumn(...) has it's change persisted in viewModel.
        public factorizeColumn(columnName: string, viewModel: ViewModel, factorsArray: object){  //type of factorsArray: Risk[]
            let factorsArrayInObject = [];
            if(!factorsArray){  //Checks for truthy value or not. Returns false if factorsArray is any of null, undefined, NaN, empty string, 0 or false.
                console.log(columnName, "factorsArray is null");
                factorsArray = this.getUnique(columnName, viewModel);
                //console.log("-=typeof(factorsArray)=-", typeof(factorsArray));
                //console.log(":::What is factorsArray:::", factorsArray);
            }

            //else{
            console.log(columnName, "factorArray is provided")
            for(let i = 0; i < Object.keys(factorsArray).length; i++){ //The best and robust way to get length of Object https://stackoverflow.com/questions/5223/length-of-a-javascript-object
                factorsArrayInObject[i] = factorsArray[i];
                  //}
            }
            viewModel.riskBubbles.forEach(magicFunction);
            console.log("<==DEBUG: 254==>");

            function magicFunction(objectItem){
                if(columnName == "angularAxis"){
                    objectItem["factorized_angularAxis"] = factorsArrayInObject.indexOf(objectItem.angularAxis) + 1;
                }
                else if(columnName == "radialAxis"){
                    objectItem["factorized_radialAxis"] = factorsArrayInObject.indexOf(objectItem.radialAxis) + 1;
                }
                else if(columnName == "bubbleColor"){
                    objectItem["factorized_bubbleColor"] = factorsArrayInObject.indexOf(objectItem.bubbleColor) + 1;
                }
                else if(columnName == "bubbleSize"){
                    objectItem["factorized_bubbleSize"] = factorsArrayInObject.indexOf(objectItem.bubbleSize) + 1;
                }
                //console.log("-==-", factorsArray.indexOf(objectItem.angularAxis));
                //console.log(objectItem);
            }

            console.log("----", viewModel);

            //return null;

        }

        /*private getViewModel(options: VisualUpdateOptions): ViewModel {

            let dv = options.dataViews;
            console.log("dataView from getViewModel:==>", dv[0]);
            let viewModel: ViewModel = {
                riskBubbles: [],
                outerMostRadius: 0
            };
            return viewModel;
        }*/
        private getViewModel(options: VisualUpdateOptions): ViewModel{
            let dv = options.dataViews; //options is of type VisualUpdateOptions which holds information about viewport height/width/dataViews
            console.log("dataView from INSIDE(getViewModel):==>", dv[0].categorical.categories);
            let viewModel: ViewModel = {
                riskBubbles: [],
                outerMostRadius: 123
            };

            /*if (!dv
                || !dv[0]
                || !dv[0].categorical
                || !dv[0].categorical.categories
                || !dv[0].categorical.categories[0].source
                //|| !dv[0].categorical.values
                || !dv[0].metadata){
                    console.log("NULL RETURNED");
                    return viewModel;
                }
            */
            let view = dv[0].categorical; //view contains the fetched data from the PBI's UI data options
            //let categories = view.categories[0];
            let categories = view.categories;
            //let values = view.values[0];
            //console.log("**Length of for loop**", categories.values.length, values.values.length, third_values.values.length);
            console.log("**Length of for loop**", categories[0].values.length, categories[1].values.length, categories[2].values.length, categories[3].values.length, categories[4].values.length, categories[5].values.length);
            
            //for (let i = 0, len = Math.max(categories.values.length, values.values.length, third_values.values.length); i < len; i++) {
            for (let i = 0, len = Math.max(categories[0].values.length, categories[1].values.length, categories[2].values.length, categories[3].values.length, categories[4].values.length, categories[5].values.length); i < len; i++) {
                viewModel.riskBubbles.push({
                    /*category: <string>categories.values[i],
                    value: <string>values.values[i],
                    third_value: <string>third_values.values[i]
                    */
                    parentLabel: <string>categories[0].values[i],
                    angularAxis: <string>categories[1].values[i],
                    radialAxis: <string>categories[2].values[i],
                    bubbleSize: <string>categories[3].values[i],
                    bubbleColor: <string>categories[4].values[i],
                    bubbleLabel: <string>categories[5].values[i],

                    factorized_angularAxis: -1,
                    factorized_radialAxis: -1,
                    factorized_bubbleColor: -1,
                    factorized_bubbleSize: -1,
                    n_points: 0,
                    angular_width: 0,
                    risk_per_angularField: 0,
                    x_partition: 0,
                    y_partition: 0,
                    x: 0,
                    y: 0,
                    angle: 0
                    //otherValues: <string>categories[6].values[i]

                    /*colour: this.host.colorPalette.getColor(<string>categories.values[i]).value,
                    identity: this.host.createSelectionIdBuilder()
                        .withCategory(categories, i)
                        .createSelectionId()*/
                });
            }

            //viewModel.maxValue = d3.max(viewModel.dataPoints, d => d.value);
            viewModel.outerMostRadius = 0;



            return viewModel;
            //return null;
        }

        private static parseSettings(dataView: DataView): VisualSettings {
            console.log("***parseSettings Called***");
            return VisualSettings.parse(dataView) as VisualSettings;
        }
    }
}