/*
Author: Om Prakash Sao
Date: 26th July 2019
Client: SHIFT Consulting
Comment: Changed all Math.floor to Math.abs
Comment: V5 = V4 + Tooltip
*/
import DataViewObjects = powerbi.extensibility.utils.dataview.DataViewObjects;
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
        otherValues: string;
        
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

        identity: powerbi.visuals.ISelectionId;
        tooltips: VisualTooltipDataItem[];
    };

    interface ViewModel {
        riskBubbles: Risk[];
        //outerMostRadius: number;
    };
    export class Visual implements IVisual {
        private host: IVisualHost;
        private svgContainer: d3.Selection<SVGElement>;
        private radialAxisGroup: d3.Selection<SVGElement>;
        private textInstructionsGroup: d3.Selection<SVGElement>;
        private template_radialAxisGroup: d3.Selection<SVGElement>;
        private radialAxisTicksGroup : d3.Selection<SVGElement>;
        private radialAxis : d3.Selection<SVGElement>;
        private angularAxisGroup: d3.Selection<SVGElement>;
        private angularAxisTicksGroup: d3.Selection<SVGElement>;

        private parentLabelGroup: d3.Selection<SVGElement>;

        private riskBubblesGroup: d3.Selection<SVGElement>;

        static isRiskOwnerDrilledDownSelected : boolean = false;
        static isRiskBubbleLabelColor_toBeAltered: boolean = false;
        static angularAxisSelected: string = null;
        

        private settings = {
            axis: {
                radialAxis:{
                    labelFontColor: {
                        default: "#808080", //grey: #808080
                        value: "#808080"
                    },
                    labelFontSize:{
                        default: 14,
                        value: 14
                    }
                },
                angularAxis:{
                    labelFontColor: {
                        default: "#808080", //grey: #808080
                        value: "#808080"
                    },
                    labelFontSize:{
                        default: 14,
                        value: 14
                    }
                }
            },
            parentLabel: {
                labelFontColor:{
                    default: "#808080", //grey: #808080
                    value: "#808080"
                },
                labelFontSize:{
                    default: 14,
                    value: 14
                },
                show:{
                    default: true,
                    value: true
                }
            },
            riskBubble: {
                
                greenColorLabel:{
                    default: "#FFFFFF", //green bubble: white label
                    value: "#FFFFFF"
                },
                amberColorLabel:{
                    default: "#000000", //amber bubble: black label
                    value: "#000000"
                },
                redColorLabel:{
                    default: "#FFFFFF", //red bubble: white label
                    value: "#FFFFFF"
                },
                labelFontSize:{
                    default: 10,
                    value: 10
                },
                bubbleSize:{
                    default: 50,
                    value: 50
                },
                greenColor:{
                    default: "#00AC50", //green: #00AC50
                    value: "#00AC50"
                },
                amberColor:{
                    default: "#FFC000", //amber: #FFC000
                    value: "#FFC000"
                },
                redColor:{
                    default: "#FF0000", //red: #FF0000
                    value: "#FF0000"
                }

            }
        }
        
        
        private angularAxisFactorLevels = null;
        
        //private angularAxisTickLabelsArray: Array<string> = [];
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
        
        private bubble_colors_map = ["#FF0000", "#FFC000", "#00AC50"]; //c(rgb(255,0,0), rgb(255,192,0), rgb(0, 176,80)) ## RED(Leadership Attention Required)/AMBER(Monitor)/GREEN(No Major Concern)  order. Text color: white/black/white order
        private RED_COLOR = "#FF0000"; private AMBER_COLOR = "#FFC000"; private GREEN_COLOR = "#00AC50";
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

            this.textInstructionsGroup = this.svgContainer.append("g").classed("template_textInstructionsGroup", true);
            this.textInstructionsGroup.append("image").classed("template_imageInstructionGroup");
            this.textInstructionsGroup.append("text").classed("template_textInstruction");
            this.textInstructionsGroup.append("text").classed("template_textInstruction");
            this.textInstructionsGroup.append("text").classed("template_textInstruction");
            this.textInstructionsGroup.append("text").classed("template_textInstruction");
            this.textInstructionsGroup.append("text").classed("template_textInstruction");
            this.textInstructionsGroup.append("text").classed("template_textInstruction");
            this.textInstructionsGroup.append("text").classed("template_textInstruction");


            this.template_radialAxisGroup = this.svgContainer
                .append("g")
                .classed("template_radialAxisGroupClass", true);

            this.template_radialAxisGroup.append("circle").classed("template_radialAxisCircle", true);
            this.template_radialAxisGroup.append("circle").classed("template_radialAxisCircle", true);
            this.template_radialAxisGroup.append("circle").classed("template_radialAxisCircle", true);
            this.template_radialAxisGroup.append("circle").classed("template_radialAxisCircle", true);
            this.template_radialAxisGroup.append("circle").classed("template_radialAxisCircle", true);

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
                //.classed("radialAxisLine", true)
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
                
            //this.angularAxisTicksGroup.append("text").classed("angularAxisTickClass", true);
            
            this.parentLabelGroup = this.svgContainer
                .append("g")
                .classed("parentClassGroupClass", true);

            this.riskBubblesGroup = this.svgContainer
                .append("g")
                .classed("riskBubblesGroupClass", true);

            this.parentLabelGroup = this.svgContainer
                .append("g")
                .classed("parentLabelGroupClass", true);
            this.parentLabelGroup.append("text").classed("parentLabelClass", true);;

            /*this.start_CoordinateRange_x = this.offset;
            this.end_CoordinateRange_x = 1 - this.offset;
            this.start_CoordinateRange_y = this.offset;
            this.end_CoordinateRange_y = 1 - this.offset;*/

            //this.angularAxisTickLabelsArray = [];
            
        }

        public update(options: VisualUpdateOptions) {
            
            this.updateSettings(options);
            console.log("**** FUNCTION CALLED: update(options: VisualUpdateOptions)****");


            //************/START: ENTRY TEMPLATE
            let width = options.viewport.width;
            let height = options.viewport.height;

            let outerMostRadialAxisRadius = Math.min(width, height) / 2 - 30; // radius of the whole chart //SAFE: -30
            
            this.svgContainer
            .style("background-color", "white") //"azure"
            .attr({
                width: width,
                height: height,
                "outerRadiusDummy": outerMostRadialAxisRadius
            });
            let textInstructions = ["Incomplete data: Please select in following order", "Parent Label :==>  Divison", "Angular Axis :==>  Department", "Radial Axis :==> Risk Proxmity", "Bubble Size :==> Risk Rating", "Bubble Color :==> RAG status(Select as \"Don\'t Summarize\")", "Bubble Label :==> Risk Rating Score", "Risk Owner/Other Values :==> Risk Owner"];
            this.textInstructionsGroup
            .data(textInstructions)
            .selectAll("text")
            .attr({
                x: function(d, i){ return "2.5em";},
                y: function(d, i){ return (2 + 1.5*(i + 1)).toString() + "em";},
                "font-weight": function(d,i){if(i==0) return "bold"; else return "normal";}
            })
            .text(function(d,i){console.log(textInstructions[i]); return textInstructions[i]});

            this.textInstructionsGroup
            .selectAll("image")
            .attr({
                x: width - 200 - 20, //200px X 200px is size of image and 20 is right side offset/padding
                y: "2em",
                width: 200,
                height: 200,
                "xlink:href": "https://media.licdn.com/dms/image/C4E0BAQGt8pAc7Fhu2A/company-logo_200_200/0?e=2159024400&v=beta&t=1uEyQ2c_wMBUY-pQ_LkQPco_GzZny4If63l1qpzuphE"
            });

            let radialAxisCircle1 = this.template_radialAxisGroup.selectAll(".template_radialAxisCircle").
            data([outerMostRadialAxisRadius/5, 2 * outerMostRadialAxisRadius/5, 3 * outerMostRadialAxisRadius/5, 4 * outerMostRadialAxisRadius/5, outerMostRadialAxisRadius]);  //WORKING
            
            radialAxisCircle1
                .style("fill-opacity", 0.4) //0.5
                .style("fill", "#ECECEC")  //#FAFAFA// Better: #ECECEC
                //.style("stroke", "grey")
                .style("stroke-width", 1)
                .attr({
                    r: d => d,
                    cx: Math.abs(width / 2),
                    cy: Math.abs(height / 2)
                });

            //************END: ENTRY TEMPLATE


            //console.log('Visual update', options);
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
                //outerMostRadius: this.settings.axis.radialAxis.outerMostRadius
            }*/

            //////=======START: DATA WRANGLING:======\\\\\\\////////

            let viewModel = this.getViewModel(options);
            if(Visual.isRiskOwnerDrilledDownSelected){
                viewModel = this.getViewModelDrillDown(options);
            }
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
                if(this.angularWeight_Array[angularAxisFactorItem_index] == 0)
                    this.angularWeight_Array[angularAxisFactorItem_index] = 3 * 1; //In some cases, angular Axis like Risk Owner names contain non-english characters and hence are assigned angle = 0 and hence angularWidth = 0, so their risk bubbles just show up at origin.
            }

            this.totalAngularWeight = this.angularWeight_Array.reduce(function getSum(total, value, index, array){ return total + value});  //https://www.w3schools.com/js/tryit.asp?filename=tryjs_es5_array_reduce
            
            //once totalAngularWeight is calculated, now calculate the angularWidth_Array
            for (let angularAxisFactorItem_index in this.angularAxisFactorLevels){ // 0-based angularAxisFactorItem_index is number in string type
                let currentAngularAxisName = this.angularAxisFactorLevels[angularAxisFactorItem_index];
                
                console.log("***", angularAxisFactorItem_index, this.angularWeight_Array[angularAxisFactorItem_index], this.totalAngularWeight );
                this.angularWidth_Array.push(Math.abs( (360 *  this.angularWeight_Array[angularAxisFactorItem_index] )/ this.totalAngularWeight )); //SAFE: Math.floor
            }

            for (let angularAxisFactorItem_index in this.angularAxisFactorLevels){ //0-based angularAxisFactorItem_index is number in string type
                if(angularAxisFactorItem_index == "0"){
                    this.cumulativeAngularWidth_Array[angularAxisFactorItem_index] = 0;
                    this.angularTickLabels_angularPosition_Array[angularAxisFactorItem_index] = Math.abs(this.angularWidth_Array[angularAxisFactorItem_index] / 2 );
                }
                else{
                    this.cumulativeAngularWidth_Array[angularAxisFactorItem_index] = Math.abs(this.angularWidth_Array[parseInt(angularAxisFactorItem_index) - 1] + this.cumulativeAngularWidth_Array[parseInt(angularAxisFactorItem_index) -1] );
                    this.angularTickLabels_angularPosition_Array[angularAxisFactorItem_index] = Math.abs(this.angularWidth_Array[parseInt(angularAxisFactorItem_index)]/2) + Math.abs(this.cumulativeAngularWidth_Array[parseInt(angularAxisFactorItem_index)] );
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
                        this.offset = 0.1; //0.05
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
                            viewModel.riskBubbles[index].angular_width = Math.abs( (360 *  this.angularWeight_Array[angularAxisFactorItem_index] )/ this.totalAngularWeight );
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
            //let bubble_size_upperlimit_factor = (0.6 + (0.4 * 6 * Bubble_bubbleSize_selection)/(number_of_sectors * 50)) #default value Bubble_bubbleSize_selection = 50
            //let bubble_size_upperlimit_factor = (0.6 + (0.4 * 6 * Bubble_bubbleSize_selection)/(number_of_sectors * 50)) //default value Bubble_bubbleSize_selection = 50
            let lowSize = 5
            let mediumSize = 7
            let highSize = 8
            let veryHighSize = 12

            //////=======END: DATA WRANGLING:======\\\\\\\////////



            console.log("**viewModel:==>", viewModel);
            console.log("**this.sentinelChartTitle", this.sentinelChartTitle);
            console.log("**this.angularWeight_Array:==>", this.angularWeight_Array);
            console.log("**this.angularTickLabels_angularPosition_Array:==>", this.angularTickLabels_angularPosition_Array);
            console.log("**this.angularWidth_Array:==>", this.angularWidth_Array);
            console.log("**this.cumulativeAngularWidth_Array:==>", this.cumulativeAngularWidth_Array);

            //////=======START: CHART PLOTTING:======\\\\\\\////////

            this.svgContainer.selectAll(".template_textInstructionsGroup").remove();
            this.svgContainer.selectAll(".template_radialAxisGroupClass").remove();

            width = options.viewport.width;
            height = options.viewport.height;

            outerMostRadialAxisRadius = Math.min(width, height) / 2 - 30; // radius of the whole chart //SAFE: -30
            //let outerMostRadialAxisRadius = Math.min(options.viewport.width, options.viewport.height) / 2 - 50; // radius of the whole chart //SAFE: -30

            this.svgContainer
            .style("background-color", "white") //"azure"
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
            let radiusArray = [Math.abs(outerMostRadialAxisRadius * 1/5), Math.abs(outerMostRadialAxisRadius * 2/5), Math.abs(outerMostRadialAxisRadius * 3/5), Math.abs(outerMostRadialAxisRadius * 4/5), Math.abs(outerMostRadialAxisRadius * 5/5)];

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
                    cx: Math.abs(width / 2),
                    cy: Math.abs(height / 2)
                });

            radialAxisCircle.exit().remove();

            this.radialAxisTicksGroup
                .selectAll(".radialAxisTickClass")
                .data(this.radialAxisTickLabelsArray)
                //.enter()
                //.append("text")
                //.style("fill", "grey")
                
                //.style("font-size", 14)
                .style("font-size", this.settings.axis.radialAxis.labelFontSize.value)
                .style("fill", this.settings.axis.radialAxis.labelFontColor.value)
                .attr({
                    dx: "0.5em",
                    x: Math.abs(width / 2),
                    y: function(d, index){ return (Math.abs(height / 2) - radialAxisScale( index + 2) ); }
                })
                .text(function(d, index){ /*console.log("--", d, index);*/ return d;});

            this.radialAxis
                .data(this.radialAxisTickLabelsArray)
                .style("stroke", "grey")  //Radial Axis Vertical line
                .style("stroke-width", 1.5)
                .attr({
                    x1: Math.abs(width / 2),
                    y1: function(d, index){ return Math.abs(height / 2) - radialAxisScale(1); },
                    x2: Math.abs(width / 2),
                    y2: Math.abs(height / 2) - outerMostRadialAxisRadius

                });

            //ANGULAR AXIS LINES
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
                .style("stroke", "grey")
                .style("stroke-width", 1)
                .attr({
                   x1: function(d, index){ return Math.abs(width/2) + radialAxisScale(1) * Math.cos( (1 * Math.PI * (270 + d) )/180); },
                   y1: function(d, index){ return Math.abs(height/2) + radialAxisScale(1) * Math.sin( (1 * Math.PI * (270 + d))/180); },
                   x2: function(d, index){ return Math.abs(width/2) +  radialAxisScale(5) * Math.cos( (1 * Math.PI * (270 + d))/180); },
                   y2: function(d, index){ return Math.abs(height/2) +  radialAxisScale(5) * Math.sin( (1 * Math.PI * (270 + d))/180); },
                   dummyAngle: function(d, index){return d;}
                });

            //ANGULAR AXIS TICKS
            let global_angularAxisFactorLevels = this.angularAxisFactorLevels;  //Because inside this.angularAxisTicksGroup's text(anonymous function) you can't access another this.<something> object
            let hold_selectedAngularAxis: string = "";
            this.angularAxisTicksGroup
                .selectAll(".angularAxisTickClass")
                //.data(this.angularTickLabels_angularPosition_Array)
                .data(this.angularTickLabels_angularPosition_Array)
                //.style("font-size", 12)
                .style("font-size", this.settings.axis.angularAxis.labelFontSize.value)
                .style("fill", this.settings.axis.angularAxis.labelFontColor.value)
                .enter()
                .append("g")
                .classed("angularAxisTickClass", true)
                .attr({
                    "transform": function(d, index){return 'rotate(' + 0 + ')';},
                })
                .append("text").classed("angularAxisTicks", true)
                //.style("fill", "grey")
                
                //.style("stroke-width", 1.5)
                //.style("text-anchor", function(d) { return d < 270 && d > 90 ? "end" : null; })
                .style("text-anchor", function(d) { return d > 200 && d < 360 ? "end" : "start"; })
                //.style("text-anchor", function(d) { return d > 160 && d <= 200 ? "middle" : "end"; })
                .attr({
                   dx: function(d) { return d > 180 && d < 360 ? "-0.5em" : "0.5em"; },
                   dy: function(d) { return d > 135 && d <= 220 ? "1em" : "0em"; },
                   //dy: function(d) { return d > 180 && d < 360 ? "0.5em" : "0em"; },
                   x: function(d, index){ return Math.abs(width/2) +  radialAxisScale(5) * Math.cos( (1 * Math.PI * (270 + d))/180); },
                   y: function(d, index){ return Math.abs(height/2) +  radialAxisScale(5) * Math.sin( (1 * Math.PI * (270 + d))/180); },
                   dummyAngle: function(d, index){return d;}
                })
                .text(function(d, i){ /*console.log("--", d, i, global_angularAxisFactorLevels);*/
                    hold_selectedAngularAxis = global_angularAxisFactorLevels[i];
                    return global_angularAxisFactorLevels[i];
                })
                //.text("Meow")
                /*.on('click', function(d,i){
                    
                    Visual.isRiskOwnerDrilledDownSelected = true;
                    Visual.angularAxisSelected = global_angularAxisFactorLevels[i];
                    console.log("Angular Label Clicko clicked:==>", global_angularAxisFactorLevels[i], Visual.isRiskOwnerDrilledDownSelected);
                    this.drillDown(options); //drilldown comes as undefined function.
                })*/
                //.on('click', this.drillDown())
                ;

            //PARENT LABEL
            let showSentinelChartTitle_flag = this.settings.parentLabel.show.value;
            let sentinelChartTitle = this.sentinelChartTitle;
            this.parentLabelGroup
                .selectAll(".parentLabelClass")
                .style("font-size", this.settings.parentLabel.labelFontSize.value)
                .style("fill", this.settings.parentLabel.labelFontColor.value)
                .style("text-anchor", "middle")
                .attr({
                    x: Math.abs(width/2),
                    y: Math.abs(height/2)
                })
                //.text(this.sentinelChartTitle);
                .text(function(d, i){ /*console.log("********************", showSentinelChartTitle_flag, sentinelChartTitle);*/
                    if(showSentinelChartTitle_flag == true) return sentinelChartTitle; else return ""; 
                });


            
            //RISK BUBBLE CIRCLES
            let green = this.settings.riskBubble.greenColor.value;
            let amber = this.settings.riskBubble.amberColor.value;
            let red = this.settings.riskBubble.redColor.value;
            let bubbleSize_selection = Math.abs(Math.abs(this.settings.riskBubble.bubbleSize.value)); //default value 50%

            this.riskBubblesGroup
                .selectAll(".riskBubbles")
                .data(viewModel.riskBubbles)
                .enter()
                .append("circle")
                .classed("riskBubblesClass", true)
                .attr({
                    "transform": function(d, index){let coors = (Math.abs(width/2) + radialAxisScale(d.y) * Math.cos((1 * Math.PI * (270 + d.angle))/180)).toString() + "," + (Math.abs(height/2) + radialAxisScale(d.y) * Math.sin((1 * Math.PI * (270 + d.angle))/180)).toString(); return 'translate(' + coors + ')';},
                    //"r": 8,
                    "r": function(d, index){
                        if(d.factorized_bubbleSize == 1)
                            return  lowSize * (bubbleSize_selection/50);
                        else if(d.factorized_bubbleSize == 2)
                            return mediumSize * (bubbleSize_selection/50);
                        else if(d.factorized_bubbleSize == 3)
                            return highSize * (bubbleSize_selection/50);
                        else if(d.factorized_bubbleSize == 4)
                            return veryHighSize * (bubbleSize_selection/50);
                    },
                    "fill": function(d, index){ //private bubble_colors_map = ["#FF0000"/RED, "#FFC000"/AMBER, "#00AC50"/GREEN]
                        if(d.factorized_bubbleColor == 1)
                            return red; //return "#FF0000"; //this.RED_COLOR;
                        else if(d.factorized_bubbleColor == 2)
                            return amber;   //return "#FFC000"; //this.AMBER_COLOR;
                        else if(d.factorized_bubbleColor == 3)
                            return green;   //return "#00AC50"; //this.GREEN_COLOR;
                    
                    },
                    "dummyAngle": function(d, index){return d.angle;}

                })
                .on("mouseover", (d) => {
                    let mouse = d3.mouse(this.svgContainer.node());
                    let x = mouse[0];
                    let y = mouse[1];

                    this.host.tooltipService.show({
                        dataItems: d.tooltips,
                        identities: [d.identity],
                        coordinates: [x, y],
                        isTouchEvent: false
                    });
                })
                .on("mousemove", (d) => {
                    let mouse = d3.mouse(this.svgContainer.node());
                    let x = mouse[0];
                    let y = mouse[1];

                    this.host.tooltipService.move({
                        dataItems: d.tooltips,
                        identities: [d.identity],
                        coordinates: [x, y],
                        isTouchEvent: false
                    });
                })
                .on("mouseout", (d) => {
                    this.host.tooltipService.hide({
                        immediately: true,
                        isTouchEvent: false
                    });
                })
                ;

            //RISK BUBBLES LABEL
            let redColorLabel = this.settings.riskBubble.redColorLabel.value;
            let amberColorLabel = this.settings.riskBubble.amberColorLabel.value;
            let greenColorLabel = this.settings.riskBubble.greenColorLabel.value;

            this.riskBubblesGroup
            .selectAll(".riskBubbles")
            .data(viewModel.riskBubbles)
            .enter()
            .append("text").classed("riskBubblesLabel", true)
            .style("fill", function(d, index){ //1: RED, 2: AMBER, 3: GREEN
                
                if(d.factorized_bubbleColor ==2 || d.factorized_bubbleSize == 1) //AMBER color or Very Low size => black label
                    return amberColorLabel;   //return "black";
                else if(d.factorized_bubbleColor == 1) //RED or GREEN bubble => white label
                    return redColorLabel;    //return "white";
                else if(d.factorized_bubbleColor == 3) //RED or GREEN bubble => white label
                    return greenColorLabel;    //return "white";
                
            })
            .style("font-size", 10)
            .style("text-anchor", "middle")
            .attr({
                "transform": function(d, index){let coors = (Math.abs(width/2) + radialAxisScale(d.y) * Math.cos((1 * Math.PI * (270 + d.angle))/180)).toString() + "," + (Math.abs(height/2) + radialAxisScale(d.y) * Math.sin((1 * Math.PI * (270 + d.angle))/180)).toString(); return 'translate(' + coors + ')';},
                dy: "0.2em"
                })
            .text(function(d, i){ /*console.log("--", d, i, global_angularAxisFactorLevels);*/ return d.bubbleLabel;}) 
            .on("mouseover", (d) => {
                let mouse = d3.mouse(this.svgContainer.node());
                let x = mouse[0];
                let y = mouse[1];

                this.host.tooltipService.show({
                    dataItems: d.tooltips,
                    identities: [d.identity],
                    coordinates: [x, y],
                    isTouchEvent: false
                });
            })
            .on("mousemove", (d) => {
                let mouse = d3.mouse(this.svgContainer.node());
                let x = mouse[0];
                let y = mouse[1];

                this.host.tooltipService.move({
                    dataItems: d.tooltips,
                    identities: [d.identity],
                    coordinates: [x, y],
                    isTouchEvent: false
                });
            })
            .on("mouseout", (d) => {
                this.host.tooltipService.hide({
                    immediately: true,
                    isTouchEvent: false
                });
            });
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
                //outerMostRadius: 0
            };
            return viewModel;
        }*/
        private getViewModel(options: VisualUpdateOptions): ViewModel{
            let dv = options.dataViews; //options is of type VisualUpdateOptions which holds information about viewport height/width/dataViews
            console.log("dataView from INSIDE(getViewModel):==>", dv[0].categorical.categories);
            let viewModel: ViewModel = {
                riskBubbles: []//,
                //outerMostRadius: 123
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
            
            console.log("------------------", Visual.isRiskOwnerDrilledDownSelected);
            //if(!Visual.isRiskOwnerDrilledDownSelected){

            let metadata = dv[0].metadata;
            let parentLabelColumnName = metadata.columns.filter(c => c.roles["parentLabel"])[0].displayName;
            let angularAxisColumnName = metadata.columns.filter(c => c.roles["angularAxis"])[0].displayName;
            let radialAxisColumnName = metadata.columns.filter(c => c.roles["radialAxis"])[0].displayName;
            let bubbleSizeColumnName = metadata.columns.filter(c => c.roles["bubbleSize"])[0].displayName;
            let bubbleColorColumnName = metadata.columns.filter(c => c.roles["bubbleColor"])[0].displayName;
            let bubbleLabelColumnName = metadata.columns.filter(c => c.roles["bubbleLabel"])[0].displayName;
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
                    angularAxis: <string>categories[1].values[i].toString().replace(/[\W_]+/g," ").trim(),  //replaces all non-alphanumeric_space with nothing
                    radialAxis: <string>categories[2].values[i],
                    bubbleSize: <string>categories[3].values[i],
                    bubbleColor: <string>categories[4].values[i],
                    bubbleLabel: <string>categories[5].values[i],
                    otherValues: <string>categories[6].values[i].toString().replace(/[\W_]+/g," ").trim(),

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
                    angle: 0,

                    identity: this.host.createSelectionIdBuilder()
                        //.withCategory(categories[], i)
                        .createSelectionId(),
                        //highlighted: highlights ? highlights[i] ? true : false : false,
                    tooltips: [
                        {
                        displayName: parentLabelColumnName,
                        value: <string>categories[0].values[i],
                        //color: "red",
                        header: "Risk Details",
                        opacity: "0"
                        },
                        {
                        displayName: angularAxisColumnName,
                        value: <string>categories[1].values[i]
                        }, 
                        {
                        displayName: radialAxisColumnName,
                        value: (<string>categories[2].values[i])
                        },
                        {
                        displayName: bubbleSizeColumnName,
                        value: <string>categories[3].values[i]
                        },
                        {
                        displayName: bubbleColorColumnName,
                        value: <string>categories[4].values[i]
                        },
                        {
                        displayName: bubbleLabelColumnName,
                        value: categories[5].values[i].toString() //<string>categories[5].values[i]
                        }
                    ]
                });
            }
            //}//Close of if(!Visual.isRiskOwnerDrilledDownSelected) body

            //viewModel.maxValue = d3.max(viewModel.dataPoints, d => d.value);
            //viewModel.outerMostRadius = 0;
            return viewModel;
            //return null;
        }

        //private drillDown(options: VisualUpdateOptions, hold_selectedAngularAxis: string){
        private drillDown(){
            //this.getViewModelDrillDown(options)
            //this.update(options);
            console.log("Selected"); //hold_selectedAngularAxis);
        }

        private getViewModelDrillDown(options: VisualUpdateOptions): ViewModel{
            let dv = options.dataViews; //options is of type VisualUpdateOptions which holds information about viewport height/width/dataViews
            console.log("dataView from INSIDE(getViewModel):==>", dv[0].categorical.categories);
            let viewModel: ViewModel = {
                riskBubbles: []//,
                //outerMostRadius: 123
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
            
            console.log("------------------", Visual.isRiskOwnerDrilledDownSelected);
            //if(!Visual.isRiskOwnerDrilledDownSelected){

            let metadata = dv[0].metadata;
            let parentLabelColumnName = metadata.columns.filter(c => c.roles["parentLabel"])[0].displayName;
            let angularAxisColumnName = metadata.columns.filter(c => c.roles["angularAxis"])[0].displayName;
            let radialAxisColumnName = metadata.columns.filter(c => c.roles["radialAxis"])[0].displayName;
            let bubbleSizeColumnName = metadata.columns.filter(c => c.roles["bubbleSize"])[0].displayName;
            let bubbleColorColumnName = metadata.columns.filter(c => c.roles["bubbleColor"])[0].displayName;
            let bubbleLabelColumnName = metadata.columns.filter(c => c.roles["bubbleLabel"])[0].displayName;
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
                    parentLabel: <string>categories[1].values[i],
                    angularAxis: <string>categories[6].values[i].toString().replace(/[\W_]+/g," ").trim(),  //replaces all non-alphanumeric_space with nothing
                    radialAxis: <string>categories[2].values[i],
                    bubbleSize: <string>categories[3].values[i],
                    bubbleColor: <string>categories[4].values[i],
                    bubbleLabel: <string>categories[5].values[i],
                    otherValues: <string>categories[0].values[i].toString().replace(/[\W_]+/g," ").trim(),

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
                    angle: 0,

                    identity: this.host.createSelectionIdBuilder()
                        //.withCategory(categories[], i)
                        .createSelectionId(),
                        //highlighted: highlights ? highlights[i] ? true : false : false,
                    tooltips: [
                        {
                        displayName: parentLabelColumnName,
                        value: <string>categories[0].values[i],
                        //color: "red",
                        header: "Risk Details",
                        opacity: "0"
                        },
                        {
                        displayName: angularAxisColumnName,
                        value: <string>categories[1].values[i]
                        }, 
                        {
                        displayName: radialAxisColumnName,
                        value: (<string>categories[2].values[i])
                        },
                        {
                        displayName: bubbleSizeColumnName,
                        value: <string>categories[3].values[i]
                        },
                        {
                        displayName: bubbleColorColumnName,
                        value: <string>categories[4].values[i]
                        },
                        {
                        displayName: bubbleLabelColumnName,
                        value: categories[5].values[i].toString() //<string>categories[5].values[i]
                        }
                    ]
                });
            }
            //}//Close of if(!Visual.isRiskOwnerDrilledDownSelected) body

            //viewModel.maxValue = d3.max(viewModel.dataPoints, d => d.value);
            //viewModel.outerMostRadius = 0;
            return viewModel;
            //return null;
        }

        private static parseSettings(dataView: DataView): VisualSettings {
            console.log("***parseSettings Called***");
            return VisualSettings.parse(dataView) as VisualSettings;
        }

        private updateSettings(options: VisualUpdateOptions) {
            //console.log("***updateSettings****SOMETHING CHANGED IN FORMATTING PANE: labelFontColor************", this.settings.axis.radialAxis.labelFontColor.value);
            //console.log("***updateSettings****SOMETHING CHANGED IN FORMATTING PANE: labelFontSize************", this.settings.axis.radialAxis.labelFontSize.value);


            //this.settings.axis.radialAxis.labelFontColor.value = DataViewObjects.getValue(options.dataViews[0].metadata.objects, { objectName: "radialAxis", propertyName: "color" }, this.settings.axis.radialAxis.labelFontColor.default);
            this.settings.axis.radialAxis.labelFontColor.value = this.fetchColorCodeFromObject(options, "radialAxis", "color", this.settings.axis.radialAxis.labelFontColor.default);
            this.settings.axis.radialAxis.labelFontSize.value = DataViewObjects.getValue(options.dataViews[0].metadata.objects, { objectName: "radialAxis", propertyName: "fontSize" }, this.settings.axis.radialAxis.labelFontSize.default);
            //console.log("*********************Show value:labelFontColor==>", this.settings.axis.radialAxis.labelFontColor.value);
            //console.log("*********************Show value:labelFontSize==>", this.settings.axis.radialAxis.labelFontSize.value);

            this.settings.axis.angularAxis.labelFontColor.value = this.fetchColorCodeFromObject(options, "angularAxis", "color", this.settings.axis.angularAxis.labelFontColor.default);
            this.settings.axis.angularAxis.labelFontSize.value = DataViewObjects.getValue(options.dataViews[0].metadata.objects, { objectName: "angularAxis", propertyName: "fontSize" }, this.settings.axis.angularAxis.labelFontSize.default);

            this.settings.parentLabel.labelFontColor.value = this.fetchColorCodeFromObject(options, "parentLabel", "color", this.settings.parentLabel.labelFontColor.default);
            this.settings.parentLabel.labelFontSize.value = DataViewObjects.getValue(options.dataViews[0].metadata.objects, { objectName: "parentLabel", propertyName: "fontSize" }, this.settings.parentLabel.labelFontSize.default);
            this.settings.parentLabel.show.value = DataViewObjects.getValue(options.dataViews[0].metadata.objects, { objectName: "parentLabel", propertyName: "show" }, this.settings.parentLabel.show.default);

            this.settings.riskBubble.greenColorLabel.value = this.fetchColorCodeFromObject(options, "riskBubble", "greenColorLabel", this.settings.riskBubble.greenColorLabel.default);
            this.settings.riskBubble.amberColorLabel.value = this.fetchColorCodeFromObject(options, "riskBubble", "amberColorLabel", this.settings.riskBubble.amberColorLabel.default);
            this.settings.riskBubble.redColorLabel.value = this.fetchColorCodeFromObject(options, "riskBubble", "redColorLabel", this.settings.riskBubble.redColorLabel.default);
            this.settings.riskBubble.labelFontSize.value = DataViewObjects.getValue(options.dataViews[0].metadata.objects, { objectName: "riskBubble", propertyName: "fontSize" }, this.settings.riskBubble.labelFontSize.default);
            this.settings.riskBubble.bubbleSize.value = DataViewObjects.getValue(options.dataViews[0].metadata.objects, { objectName: "riskBubble", propertyName: "bubbleSize" }, this.settings.riskBubble.bubbleSize.default);

            this.settings.riskBubble.greenColor.value = this.fetchColorCodeFromObject(options, "riskBubble", "greenColor", this.settings.riskBubble.greenColor.default);
            this.settings.riskBubble.amberColor.value = this.fetchColorCodeFromObject(options, "riskBubble", "amberColor", this.settings.riskBubble.amberColor.default);
            this.settings.riskBubble.redColor.value = this.fetchColorCodeFromObject(options, "riskBubble", "redColor", this.settings.riskBubble.redColor.default);

            //console.log("*********************Show value:labelFontColor==>", this.settings.axis.angularAxis.labelFontColor.value);
            //console.log("*********************Show value:labelFontSize==>", this.settings.axis.angularAxis.labelFontSize.value);

            /*this.settings.axis.x.show.value = DataViewObjects.getValue(options.dataViews[0].metadata.objects, { objectName: "xAxis", propertyName: "show" }, this.settings.axis.x.show.default);
            this.settings.axis.x.padding.value = DataViewObjects.getValue(options.dataViews[0].metadata.objects, { objectName: "xAxis", propertyName: "padding" }, this.settings.axis.x.padding.default);
            this.settings.axis.x.color.value = DataViewObjects.getFillColor(options.dataViews[0].metadata.objects, { objectName: "xAxis", propertyName: "color" }, this.settings.axis.x.color.default);
            this.settings.axis.y.show.value = DataViewObjects.getValue(options.dataViews[0].metadata.objects, { objectName: "yAxis", propertyName: "show" }, this.settings.axis.y.show.default);
            this.settings.axis.y.padding.value = DataViewObjects.getValue(options.dataViews[0].metadata.objects, { objectName: "yAxis", propertyName: "padding" }, this.settings.axis.y.padding.default);
            this.settings.axis.y.color.value = DataViewObjects.getFillColor(options.dataViews[0].metadata.objects, { objectName: "yAxis", propertyName: "color" }, this.settings.axis.y.color.default);
            this.settings.border.top.value = DataViewObjects.getValue(options.dataViews[0].metadata.objects, { objectName: "borders", propertyName: "top" }, this.settings.border.top.default);
            this.settings.border.bottom.value = DataViewObjects.getValue(options.dataViews[0].metadata.objects, { objectName: "borders", propertyName: "bottom" }, this.settings.border.bottom.default);
            console.log("*********************Show value:==>", this.settings.axis.radialAxis.labelColor.value);
            */
        }

        public fetchColorCodeFromObject(options: VisualUpdateOptions, objectName_param: string, propertyName_param: string, defaultValue_param: string): string {
            let hold_object_or_string = DataViewObjects.getValue(options.dataViews[0].metadata.objects, { objectName: objectName_param, propertyName: propertyName_param }, defaultValue_param);
            if(typeof hold_object_or_string === 'object' && typeof hold_object_or_string !== null)
                return hold_object_or_string["solid"]["color"];
            else
                return hold_object_or_string;
        }

        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
            /*console.log("*******SOMETHING CHANGED IN FORMATTING PANE: angularAxis.labelFontColor************", this.settings.axis.angularAxis.labelFontColor.value);
            console.log("*******SOMETHING CHANGED IN FORMATTING PANE: angularAxis.labelFontSize************", this.settings.axis.angularAxis.labelFontSize.value);

            console.log("*******SOMETHING CHANGED IN FORMATTING PANE: radialAxis.labelFontColor************", this.settings.axis.radialAxis.labelFontColor.value);
            console.log("*******SOMETHING CHANGED IN FORMATTING PANE: radialangularAxis.labelFontSize************", this.settings.axis.radialAxis.labelFontSize.value);
            */
            let propertyGroupName = options.objectName;
            let properties: VisualObjectInstance[] = [];

            console.log("**propertyGroupName", propertyGroupName);
            /*if(typeof this.settings.axis.radialAxis.labelFontColor.value === 'object' && this.settings.axis.radialAxis.labelFontColor.value !== null){
                let radialAxis_labelFontColorReceivedAsObject = this.settings.axis.radialAxis.labelFontColor.value;
                console.log("^^^^^^^^^S A V E ME GOD^^^^^^^", radialAxis_labelFontColorReceivedAsObject["solid"]["color"]);
            }*/
            switch (propertyGroupName) {
                case "radialAxis":
                    properties.push({
                        objectName: propertyGroupName,
                        properties: {
                            color: this.settings.axis.radialAxis.labelFontColor.value,
                            fontSize: this.settings.axis.radialAxis.labelFontSize.value
                        },
                        selector: null
                    });
                    break;

                case "angularAxis":
                    properties.push({
                        objectName: propertyGroupName,
                        properties: {
                            color: this.settings.axis.angularAxis.labelFontColor.value,
                            fontSize: this.settings.axis.angularAxis.labelFontSize.value
                        },
                        selector: null
                    });
                    break;

                case "parentLabel":
                    properties.push({
                        objectName: propertyGroupName,
                        properties: {
                            color: this.settings.parentLabel.labelFontColor.value,
                            fontSize: this.settings.parentLabel.labelFontSize.value,
                            show: this.settings.parentLabel.show.value
                        },
                        selector: null
                    });
                    break;

                case "riskBubble":
                    properties.push({
                        objectName: propertyGroupName,
                        properties: {
                            greenColorLabel: this.settings.riskBubble.greenColorLabel.value,
                            amberColorLabel: this.settings.riskBubble.amberColorLabel.value,
                            redColorLabel: this.settings.riskBubble.redColorLabel.value,
                            fontSize: this.settings.riskBubble.labelFontSize.value,
                            bubbleSize: this.settings.riskBubble.bubbleSize.value,

                            greenColor: this.settings.riskBubble.greenColor.value,
                            amberColor: this.settings.riskBubble.amberColor.value,
                            redColor: this.settings.riskBubble.redColor.value
                        },
                        selector: null
                    });
                    break;
            };

            return properties;
        }
    }
}