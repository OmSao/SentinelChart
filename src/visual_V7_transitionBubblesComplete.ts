/*
Author: Om Prakash Sao
Date: 26th July 2019
Client: SHIFT Consulting
Comment: Changed all Math.floor to Math.abs
Comment: V7 = V6(slider complete) + Transition of Risk Bubbles
*/
import DataViewObjects = powerbi.extensibility.utils.dataview.DataViewObjects;
module powerbi.extensibility.visual {
    "use strict";
    interface Risk {
        parentLabel: string;
        angularAxis: string;
        radialAxis: string;
        bubbleSize: string;
        bubbleColor: string;
        bubbleLabel: string;
        riskOwner: string;
        riskDate: string;
        
        factorized_angularAxis: number,
        factorized_radialAxis: number,
        factorized_bubbleColor: number,
        factorized_bubbleSize: number,
        factorized_riskDate: number,
        n_points: number;
        angular_width: number;
        risks_per_angularField: number;
        x_partition: number;
        y_partition: number;
        x: number;
        y: number;
        angle: number;
        riskDateMilliseconds: number;

        identity: powerbi.visuals.ISelectionId;
        tooltips: VisualTooltipDataItem[];
    };

    interface ViewModel {
        riskBubbles: Risk[];
        //outerMostRadius: number;
    };
    export class Visual implements IVisual {
        private static host: IVisualHost;
        private static viewModel: ViewModel;
        private static viewModel_wholePeriod: ViewModel;
        private static bubblesDetailsObject = null;
        private svgContainer: d3.Selection<SVGElement>;
        private radialAxisGroup: d3.Selection<SVGElement>;
        private textInstructionsGroup: d3.Selection<SVGElement>;

        private playButtonCircle: d3.Selection<SVGElement>;
        private playButtonText: d3.Selection<SVGElement>;
        private slider: d3.Selection<SVGElement>;
        private handle: d3.Selection<SVGElement>;
        private labelStart: d3.Selection<SVGElement>;
        private labelEnd: d3.Selection<SVGElement>;

        private template_radialAxisGroup: d3.Selection<SVGElement>;
        private radialAxisTicksGroup : d3.Selection<SVGElement>;
        private radialAxis : d3.Selection<SVGElement>;
        private angularAxisGroup: d3.Selection<SVGElement>;
        private angularAxisTicksGroup: d3.Selection<SVGElement>;

        private parentLabelGroup: d3.Selection<SVGElement>;

        private riskBubblesGroup: d3.Selection<SVGElement>;


        static isAngularAxisDrilledDown : boolean = false;
        static isRiskBubbleLabelColor_toBeAltered: boolean = false;
        static angularAxisSelected: string = null; //"Asset Management"; null;
        private x_playAxisScale: null;
        private static riskDateSelectedFactorValue = 1;
        private static timer = null;
        private dataset = null;


        private formatDateIntoYear = d3.time.format("%Y"); //d3.timeFormat("%Y");
        private formatDateIntoMonthYear = d3.time.format("%b %Y"); //d3.timeFormat("%Y");
        private formatDate = d3.time.format("%b %Y"); //d3.timeFormat("%b %Y");
        private parseDate = d3.time.format("%m/%d/%y"); //d.date = parseDate.parse(d.date);  //d3.timeParse("%m/%d/%y");

        public static moving: boolean = false;
        public static currentValue = 0; //"2018-12-31T18:30:00.000Z";
        public static targetValue = 0; //width - 50;
        
        
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
                    default: 8,
                    value: 8
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

            },
            angularAxisDrillDown:{
                show:{
                    default: true,
                    value: true
                },
                angularAxisList:{
                    default: null,
                    value: null
                }
            },
            playAxis:{
                tickLabelFontColor:{
                    default: "#808080", //grey: #808080
                    value: "#808080"
                },
                tickLabelFontSize:{
                    default: 12,
                    value: 12
                },
                show:{
                    default: true,
                    value: true
                }
            }
        }
        
        
        private static angularAxisFactorLevels = null;
        
        //private angularAxisTickLabelsArray: Array<string> = [];
        //private datesArray = ["1/1/2019", "2/1/2019", "3/1/2019", "4/1/2019", "5/1/2019"];

        private static radialAxisTickLabelsArray = ["Latent", "Immediate / already impacting", "< 3 months", "> 3 months"];
        private static radialAxisFactorLevels = ["Latent (may occure anytime) e.g., safety realted, geopolitical risks", "Immediate / already impacting", "< 3 months", "> 3 months"];
        private static riskDateFactorLevels = null;

        private static bubbleColorsFactorLevels = ["Leadership Attention Required", "Monitor / Periodic Review", "No Major Concerns / Risk Effectively Mitigated"];
        //["Monitor / Perioic Review", "No Major Concerns / Risk Effectively Mitigated", "Leadership Attention Required"]
        
        private static bubbleSizesFactorLevels = ["Low", "Medium", "High", "Very High"];

        private static totalNumberOfRisks = 0;
        private numberOfSectors = 0;

        private static angularWidth_Array = [];
        private static angularWeight_Array = [];
        private static totalAngularWeight = 0;
        private static cumulativeAngularWidth_Array = [];
        private static angularTickLabels_angularPosition_Array = [];
        private static riskPerAngularField = 0;

        private static offset = 0.2
        private static start_CoordinateRange_x = Visual.offset;
        private static end_CoordinateRange_x = 1 - Visual.offset;
        private static start_CoordinateRange_y = Visual.offset
        private static end_CoordinateRange_y = 1 - Visual.offset;
        
        private bubble_colors_map = ["#FF0000", "#FFC000", "#00AC50"]; //c(rgb(255,0,0), rgb(255,192,0), rgb(0, 176,80)) ## RED(Leadership Attention Required)/AMBER(Monitor)/GREEN(No Major Concern)  order. Text color: white/black/white order
        private RED_COLOR = "#FF0000"; private AMBER_COLOR = "#FFC000"; private GREEN_COLOR = "#00AC50";
        private static sentinelChartTitle: string = null;
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
            Visual.host = options.host;
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
            this.textInstructionsGroup.append("text").classed("template_textInstruction");

            this.textInstructionsGroup.append("text").classed("template_textInstruction");
            this.textInstructionsGroup.append("text").classed("template_textInstruction");
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

            this.slider = this.svgContainer.append("g").classed("slider", true);
            this.playButtonCircle = this.slider.append("circle").classed("playPauseButton", true); 
            this.playButtonText = this.slider.append("text").classed("playPauseTextClass", true);

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

            this.parentLabelGroup = this.svgContainer
                .append("g")
                .classed("parentClassGroupClass", true);

            this.riskBubblesGroup = this.svgContainer
                .append("g")
                .classed("riskBubblesGroupClass", true);

            this.parentLabelGroup = this.svgContainer
                .append("g")
                .classed("parentLabelGroupClass", true);
            this.parentLabelGroup.append("g").classed("parentLabelClass", true);;
            
        }

        public update(options: VisualUpdateOptions) {
            
            this.updateSettings(options);
            //console.log("**** FUNCTION CALLED: update(options: VisualUpdateOptions)****");

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
            //let textInstructions = ["Incomplete data: Please select in following order", "Parent Label :==>  Divison", "Angular Axis :==>  Department", "Radial Axis :==> Risk Proxmity", "Bubble Size :==> Risk Rating", "Bubble Color :==> RAG status", "Bubble Label :==> Risk ID(Select as \"Don\'t Summarize\")", "Risk Owner/Other Values :==> Risk Owner"];
            let textInstructions = ["Incomplete data: Please select in following order", "Parent Label :", "Divison", "Angular Axis :", "Department", "Radial Axis :", "Risk Proxmity", "Bubble Size :", "Risk Rating", "Bubble Color :", "RAG status", "Bubble Label :", "Risk ID(Select as \"Don\'t Summarize\")", "Risk Owner:", "Risk Owner", "Play Axis", "Risk Date"];
            this.textInstructionsGroup
            .data(textInstructions)
            .selectAll("text")
            .attr({
                x: function(d, i){ if(i==0 || i%2==1) return "2.5em"; else return "10.5em";},
                y: function(d, i){ return (2 + 1.5*( Math.floor((i-1)/2) + 1)).toString() + "em";},
                "font-weight": function(d,i){if(i==0 || i%2==1) return "bold"; else return "normal";},  //bold to 0th, 1st, 3rd, 5th and so on index
                "fill": function(d, i){return i == 0 ? "red" : "black"; }
            })
            .text(function(d,i){/*console.log(textInstructions[i]);*/ return textInstructions[i]});

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

            //////=======START: DATA WRANGLING:======\\\\\\\////////

            let radialAxis_1_weight = 0; let radialAxis_2_weight = 0;  let radialAxis_3_weight = 0; let radialAxis_4_weight = 0;

            if(Visual.isAngularAxisDrilledDown){
                this.svgContainer.selectAll(".angularAxisLine").remove();
                this.svgContainer.selectAll(".angularAxisTicks").remove();
                this.svgContainer.selectAll(".angularAxisTickClass").remove();
                
                this.svgContainer.selectAll(".riskBubblesClass").remove();
                this.svgContainer.selectAll(".riskBubblesLabel").remove();
                radialAxis_1_weight = 3; radialAxis_2_weight = 2; radialAxis_3_weight = 1; radialAxis_4_weight = 1;

                /*if(this.settings.playAxis.show.value == true){
                    console.log("SHOW PLAY AXIS");
                    this.svgContainer.selectAll(".slider").remove();
                    this.svgContainer.selectAll(".playPauseButton").remove();
                    this.svgContainer.selectAll(".playPauseTextClass").remove();
                }
                else{
                    console.log("DON'T SHOW PLAY AXIS");
                    this.svgContainer.selectAll(".slider").remove();
                    this.svgContainer.selectAll(".playPauseButton").remove();
                    this.svgContainer.selectAll(".playPauseTextClass").remove();
                }*/
                /*this.svgContainer.selectAll(".slider").remove();
                this.svgContainer.selectAll(".tickLabels").remove();
                this.svgContainer.selectAll(".tickMarks").remove();
                */

                //this.svgContainer.selectAll(".track").remove();
                //this.svgContainer.selectAll(".track-inset").remove();
                //this.svgContainer.selectAll(".track-overlay").remove();

                Visual.viewModel = this.getViewModelDrillDown(options, Visual.angularAxisSelected);
            }
            else{
                this.svgContainer.selectAll(".angularAxisLine").remove();
                this.svgContainer.selectAll(".angularAxisTicks").remove();
                this.svgContainer.selectAll(".angularAxisTickClass").remove();
                
                this.svgContainer.selectAll(".riskBubblesClass").remove();
                this.svgContainer.selectAll(".riskBubblesLabel").remove();
                radialAxis_1_weight = 8; radialAxis_2_weight = 4; radialAxis_3_weight = 2; radialAxis_4_weight = 1;
                
                /*if(this.settings.playAxis.show.value == true){
                    console.log("SHOW PLAY AXIS");
                    this.svgContainer.selectAll(".slider").remove();
                    this.svgContainer.selectAll(".playPauseButton").remove();
                    this.svgContainer.selectAll(".playPauseTextClass").remove();
                }
                else{
                    console.log("DON'T SHOW PLAY AXIS");
                    this.svgContainer.selectAll(".slider").remove();
                    this.svgContainer.selectAll(".playPauseButton").remove();
                    this.svgContainer.selectAll(".playPauseTextClass").remove();
                }*/
                /*this.svgContainer.selectAll(".slider").remove();
                this.svgContainer.selectAll(".tickLabels").remove();
                this.svgContainer.selectAll(".tickMarks").remove();
                */

                //this.svgContainer.selectAll(".track").remove();
                //this.svgContainer.selectAll(".track-inset").remove();
                //this.svgContainer.selectAll(".track-overlay").remove();

                Visual.viewModel = Visual.getViewModel(options);
                
            }
            
            console.log("^^^^viewModel fetched^^^^", Visual.viewModel);

            //console.log("^^^getUnique: radialAxis^^^", typeof(this.getUnique("radialAxis", Visual.viewModel)), this.getUnique("radialAxis", Visual.viewModel) );
            //console.log("^^^getUnique: angularAxis^^^", typeof(this.getUnique("angularAxis", Visual.viewModel)), this.getUnique("angularAxis", Visual.viewModel));
            //console.log("^^^getUnique: bubbleColor^^^", typeof(this.getUnique("bubbleColor", Visual.viewModel)), this.getUnique("bubbleColor", Visual.viewModel));
            //console.log("^^^getUnique: riskDate^^^", typeof(this.getUnique("riskDate", Visual.viewModel)), this.getUnique("riskDate", Visual.viewModel));
            
            Visual.angularAxisFactorLevels = this.getUnique("angularAxis", Visual.viewModel);

            Visual.radialAxisFactorLevels = ["Latent (may occure anytime) e.g., safety realted, geopolitical risks", "Immediate / already impacting", "< 3 months", "> 3 months"];
            Visual.riskDateFactorLevels = this.getUnique("riskDate", Visual.viewModel);
            Visual.sentinelChartTitle = String(this.getUnique("parentLabel", Visual.viewModel)); // paste("", paste(levels(risk_register_data$parentLabel), collapse = ", "))

            Visual.totalNumberOfRisks = Visual.viewModel.riskBubbles.length;
            this.numberOfSectors = Visual.angularAxisFactorLevels.length;

            this.bubble_size_upperlimit_factor = (0.6 + (0.4 * 6 * this.Bubble_bubbleSize_selection)/(this.numberOfSectors * 50)) //#default value Bubble_bubbleSize_selection = 50

            this.lowSize <- 8 * this.bubble_size_upperlimit_factor
            this.mediumSize <- 12 * this.bubble_size_upperlimit_factor
            this.highSize <- 16 * this.bubble_size_upperlimit_factor
            this.veryHighSize <- 24 * this.bubble_size_upperlimit_factor

            Visual.angularWidth_Array = [];  //size: number of angular sectors
            Visual.angularWeight_Array = [];  //size: number of angular sectors
            Visual.totalAngularWeight = 0;  
            Visual.cumulativeAngularWidth_Array = []; //size: number of angular sectors
            Visual.angularTickLabels_angularPosition_Array = []; //size: number of angular tick labels
            Visual.riskPerAngularField = 0;

            //Below 5 factorizeColumn(..) calls are call by reference. Hence, changes viewModel persistently.
            this.factorizeColumn("angularAxis", Visual.viewModel, null); //radialAxisFactorLevels
            this.factorizeColumn("radialAxis", Visual.viewModel, Visual.radialAxisFactorLevels); 
            this.factorizeColumn("bubbleColor", Visual.viewModel, Visual.bubbleColorsFactorLevels); 
            this.factorizeColumn("bubbleSize", Visual.viewModel, Visual.bubbleSizesFactorLevels); 
            this.factorizeColumn("riskDate", Visual.viewModel, null); 


            Visual.viewModel_wholePeriod = Visual.getViewModel(options); //this.viewModel;

            //Below 5 factorizeColumn(..) calls are call by reference. Hence, changes viewModel persistently.
            this.factorizeColumn("angularAxis", Visual.viewModel_wholePeriod, null); //radialAxisFactorLevels
            this.factorizeColumn("radialAxis", Visual.viewModel_wholePeriod, Visual.radialAxisFactorLevels); 
            this.factorizeColumn("bubbleColor", Visual.viewModel_wholePeriod, Visual.bubbleColorsFactorLevels); 
            this.factorizeColumn("bubbleSize", Visual.viewModel_wholePeriod, Visual.bubbleSizesFactorLevels); 
            this.factorizeColumn("riskDate", Visual.viewModel_wholePeriod, null); 
            //console.log("Visual.viewModel_wholePeriod:==>", Visual.viewModel_wholePeriod); 
            

            //*********START: Prepare Bubbles details for Prev and Next time ticks */
            
            let initial_riskDateSelectedFactorValue = Visual.riskDateSelectedFactorValue;
            Visual.bubblesDetailsObject = {};
            //Visual.bubblesDetailsObject["consolidated"] = null;
            let uniqueIndexForConsolidation = 55555;
            Visual.bubblesDetailsObject[uniqueIndexForConsolidation] = {};
            Visual.bubblesDetailsObject["bubblesTransitionLocationsArray"] = [];
            //Don't evaluate Visual.bubblesDetailsObject with every time this.update is called.
            console.log("Before IF condition: Visual.getBubblesDetailsObject.length, Visual.viewModel_wholePeriod.riskBubbles.length:==>", Visual.getBubblesDetailsObject.length, Visual.viewModel_wholePeriod.riskBubbles.length);
            if(Visual.getBubblesDetailsObject.length != Visual.viewModel_wholePeriod.riskBubbles.length){
                //*Visual.getBubblesDetailsObject() function for  fetching all bubbles information for all time ticks
                //Visual.getBubblesDetailsObject();  // Call this function before filtering Visual.viewModel datewise, so that it will contain all the risks details for whole time period. Also, all "x" and "y" here are zero. Because, so far n_points, x, y, x_partition, y_partition are not calculated.
                let particularRisk = null;
                let stringOf_RiskDateSelectedFactorValue: string = null;

                for(let i = 0; i < Visual.riskDateFactorLevels.length; i++){
                    console.log(Visual.riskDateFactorLevels[i]);
                    Visual.riskDateSelectedFactorValue = i + 1;

                    Visual.angularWidth_Array = [];  //size: number of angular sectors
                    Visual.angularWeight_Array = [];  //size: number of angular sectors
                    Visual.totalAngularWeight = 0;  
                    Visual.cumulativeAngularWidth_Array = []; //size: number of angular sectors
                    Visual.angularTickLabels_angularPosition_Array = []; //size: number of angular tick labels
                    Visual.riskPerAngularField = 0;
        
                    //Below 5 factorizeColumn(..) calls are call by reference. Hence, changes viewModel persistently.
                    this.factorizeColumn("angularAxis", Visual.viewModel, null); //radialAxisFactorLevels
                    this.factorizeColumn("radialAxis", Visual.viewModel, Visual.radialAxisFactorLevels); 
                    this.factorizeColumn("bubbleColor", Visual.viewModel, Visual.bubbleColorsFactorLevels); 
                    this.factorizeColumn("bubbleSize", Visual.viewModel, Visual.bubbleSizesFactorLevels); 
                    this.factorizeColumn("riskDate", Visual.viewModel, null); 
        
                    Visual.get_dateSpecificFilterVM_thenSetFollowing_cumulativeAngularWidth_angularTickLabels_angularPosition_Array(Visual.riskDateSelectedFactorValue, radialAxis_1_weight, radialAxis_2_weight, radialAxis_3_weight, radialAxis_4_weight);
                    //console.log("DEBUG#547: REACHED");
                    Visual.set_plottingEssentialColumnsInViewModelRiskBubbles();
                    //console.log("DEBUG#549: REACHED");

                    //let particularRisk = null;
                    stringOf_RiskDateSelectedFactorValue = "_" + Visual.riskDateSelectedFactorValue.toString();
                    for(var obj in Visual.viewModel.riskBubbles){ //obj is index number of riskBubble[] array
                        //console.log(obj, Visual.viewModel.riskBubbles[obj]["factorized_riskDate"]);
                        particularRisk = Visual.viewModel.riskBubbles[obj];
                        if(Visual.bubblesDetailsObject[particularRisk["factorized_riskDate"]] == null){
                            Visual.bubblesDetailsObject[particularRisk["factorized_riskDate"]] = {};
                        }
                        Visual.bubblesDetailsObject[particularRisk["factorized_riskDate"]][particularRisk["bubbleLabel"]] = {"angle": particularRisk["angle"],
                            "x": particularRisk["x"], 
                            "y": particularRisk["y"],
                            "factorized_bubbleColor": particularRisk["factorized_bubbleColor"], 
                            "factorized_bubbleSize": particularRisk["factorized_bubbleSize"],
                            "factorized_riskDate": particularRisk["factorized_riskDate"],
                            "bubbleSize": particularRisk["bubbleSize"], 
                            "bubbleLabel": particularRisk["bubbleLabel"]};

                        //Tip: We can't provide an expression in the key therefore, wer need to assign it in Visual.bubblesDetailsObject[uniqueIndexForConsolidation]["key" + test] = "something";
                        if(Visual.bubblesDetailsObject[uniqueIndexForConsolidation][particularRisk["bubbleLabel"]] == null){
                            Visual.bubblesDetailsObject[uniqueIndexForConsolidation][particularRisk["bubbleLabel"]] = {};
                        }
                        Visual.bubblesDetailsObject[uniqueIndexForConsolidation][particularRisk["bubbleLabel"]]["angle" + stringOf_RiskDateSelectedFactorValue] = !isNaN(particularRisk["angle"]) ? particularRisk["angle"] : 0;
                        Visual.bubblesDetailsObject[uniqueIndexForConsolidation][particularRisk["bubbleLabel"]]["x" + stringOf_RiskDateSelectedFactorValue] = !isNaN(particularRisk["x"]) ? particularRisk["x"] : 0;
                        Visual.bubblesDetailsObject[uniqueIndexForConsolidation][particularRisk["bubbleLabel"]]["y" + stringOf_RiskDateSelectedFactorValue] = !isNaN(particularRisk["y"]) ? particularRisk["y"] : 0;
                        Visual.bubblesDetailsObject[uniqueIndexForConsolidation][particularRisk["bubbleLabel"]]["factorized_bubbleColor" + stringOf_RiskDateSelectedFactorValue] = !isNaN(particularRisk["factorized_bubbleColor"]) ? particularRisk["factorized_bubbleColor"] : -1;
                        Visual.bubblesDetailsObject[uniqueIndexForConsolidation][particularRisk["bubbleLabel"]]["factorized_bubbleSize" + stringOf_RiskDateSelectedFactorValue] = !isNaN(particularRisk["factorized_bubbleSize"]) ? particularRisk["factorized_bubbleSize"]: -1;
                        Visual.bubblesDetailsObject[uniqueIndexForConsolidation][particularRisk["bubbleLabel"]]["factorized_riskDate" + stringOf_RiskDateSelectedFactorValue] = !isNaN(particularRisk["factorized_riskDate"]) ? particularRisk["factorized_riskDate"] : -1;
                        //Visual.bubblesDetailsObject[uniqueIndexForConsolidation][particularRisk["bubbleLabel"]]["bubbleSize" + stringOf_RiskDateSelectedFactorValue] = !isNaN(particularRisk["bubbleSize"]) ? particularRisk["bubbleSize"] : 0;
                        Visual.bubblesDetailsObject[uniqueIndexForConsolidation][particularRisk["bubbleLabel"]]["bubbleLabel" + stringOf_RiskDateSelectedFactorValue] = !isNaN(particularRisk["bubbleLabel"]) ? particularRisk["bubbleLabel"] : "";
                        

                    }
                    if(Visual.isAngularAxisDrilledDown){
                        Visual.viewModel = this.getViewModelDrillDown(options, Visual.angularAxisSelected);
                        
                    }
                    else{
                        Visual.viewModel = Visual.getViewModel(options);
                    }
                }
                
                //Now, once bubblesDetailsObject is created. Insert for "0" riskDetails, so that for "1" there will Previous.
                Visual.bubblesDetailsObject[0] = {}; //Visual.bubblesDetailsObject["1"]; //[...Visual.bubblesDetailsObject["1"]];
                for(var obj in Visual.bubblesDetailsObject[1]){ //obj is index number of riskBubble[] array
                    Visual.bubblesDetailsObject[0][obj] = {"bubbleSize": 0, 
                    "x": 0, 
                    "y": 0,
                    "angle": 0,
                    "factorized_bubbleColor": -1, 
                    "factorized_bubbleSize": -1,
                    "factorized_riskDate": -1,
                    "bubbleLabel": -1};
                }

                //Insert for the 0th riskDetails tick and also check if all other ticks present or not. if not, then insert zero integer or empty string values for them.
                stringOf_RiskDateSelectedFactorValue = "_0";
                for(var obj in Visual.bubblesDetailsObject[uniqueIndexForConsolidation]){ //obj is name of keys
                    Visual.bubblesDetailsObject[uniqueIndexForConsolidation][obj]["angle" + stringOf_RiskDateSelectedFactorValue] = 0;
                    Visual.bubblesDetailsObject[uniqueIndexForConsolidation][obj]["x" + stringOf_RiskDateSelectedFactorValue] = 0;
                    Visual.bubblesDetailsObject[uniqueIndexForConsolidation][obj]["y" + stringOf_RiskDateSelectedFactorValue] = 0;
                    Visual.bubblesDetailsObject[uniqueIndexForConsolidation][obj]["factorized_bubbleColor" + stringOf_RiskDateSelectedFactorValue] = -1;
                    Visual.bubblesDetailsObject[uniqueIndexForConsolidation][obj]["factorized_bubbleSize" + stringOf_RiskDateSelectedFactorValue] = -1;
                    Visual.bubblesDetailsObject[uniqueIndexForConsolidation][obj]["factorized_riskDate" + stringOf_RiskDateSelectedFactorValue] = -1;
                    //Visual.bubblesDetailsObject[uniqueIndexForConsolidation][obj]["bubbleSize" + stringOf_RiskDateSelectedFactorValue] = -1;
                    Visual.bubblesDetailsObject[uniqueIndexForConsolidation][obj]["bubbleLabel" + stringOf_RiskDateSelectedFactorValue] = "";
                    
                    //Handle cases of some risk bubbles missing or entering midway during time period. Insert their enteries with zero integer values or empty strings.
                    for(let i = 1; i <= Visual.riskDateFactorLevels.length; i++){
                        //IF condition to check if, all the riskDate factors enteries for their angle,x,y,factorized_bubbleColor, factorized_bubbleSize, factorized_riskDate, bubbleSize,bubbleLabel exists or not. If not, insert them.
                        if(Visual.bubblesDetailsObject[uniqueIndexForConsolidation][obj]["angle_" + i.toString() ] == null || isNaN(Visual.bubblesDetailsObject[uniqueIndexForConsolidation][obj]["angle_" + i.toString() ])  ){  
                            console.log("Missing or NaN:==>(bubbleLabel, riskDateFactor)", obj, i);
                            Visual.bubblesDetailsObject[uniqueIndexForConsolidation][obj]["angle_" + i.toString()] = 0;
                            Visual.bubblesDetailsObject[uniqueIndexForConsolidation][obj]["x_" + i.toString()] = 0;
                            Visual.bubblesDetailsObject[uniqueIndexForConsolidation][obj]["y_" + i.toString()] = 0;
                            Visual.bubblesDetailsObject[uniqueIndexForConsolidation][obj]["factorized_bubbleColor_" + i.toString()] = -1;
                            Visual.bubblesDetailsObject[uniqueIndexForConsolidation][obj]["factorized_bubbleSize_" + i.toString()] = -1;
                            Visual.bubblesDetailsObject[uniqueIndexForConsolidation][obj]["factorized_riskDate_" + i.toString()] = -1;
                            //Visual.bubblesDetailsObject[uniqueIndexForConsolidation][obj]["bubbleSize_" + i.toString()] = -1;
                            Visual.bubblesDetailsObject[uniqueIndexForConsolidation][obj]["bubbleLabel_" + i.toString()] = "";
                        }
                    }

                    Visual.bubblesDetailsObject["bubblesTransitionLocationsArray"].push(Visual.bubblesDetailsObject[uniqueIndexForConsolidation][obj]);
                }  
            }
            Visual.riskDateSelectedFactorValue = initial_riskDateSelectedFactorValue;
            
            for(let i = 0; i < Visual.riskDateFactorLevels.length; i++){
                console.log("RiskDate Factors, length of the array", i, Object.keys(Visual.bubblesDetailsObject[i]).length);
            }
            console.log("uniqueIndexForConsolidation object contains number of elements#", Object.keys(Visual.bubblesDetailsObject[uniqueIndexForConsolidation]).length);
            console.log("COMPLETE REFACTORED: VisualbubblesDetailsObject:==>", Visual.bubblesDetailsObject);

            //*********END: Prepare Bubbles details for Prev and Next time ticks */


            
            Visual.angularWidth_Array = [];  //size: number of angular sectors
            Visual.angularWeight_Array = [];  //size: number of angular sectors
            Visual.totalAngularWeight = 0;  
            Visual.cumulativeAngularWidth_Array = []; //size: number of angular sectors
            Visual.angularTickLabels_angularPosition_Array = []; //size: number of angular tick labels
            Visual.riskPerAngularField = 0;

            //Below 5 factorizeColumn(..) calls are call by reference. Hence, changes viewModel persistently.
            this.factorizeColumn("angularAxis", Visual.viewModel, null); //radialAxisFactorLevels
            this.factorizeColumn("radialAxis", Visual.viewModel, Visual.radialAxisFactorLevels); 
            this.factorizeColumn("bubbleColor", Visual.viewModel, Visual.bubbleColorsFactorLevels); 
            this.factorizeColumn("bubbleSize", Visual.viewModel, Visual.bubbleSizesFactorLevels); 
            this.factorizeColumn("riskDate", Visual.viewModel, null); 
            
            //DESCRIPTION: function get_cumulativeAngularWidth_angularTickLabels_angularPosition_Array(): sets: (1.)this.angularWeight_Array, this.totalAngularWeight, (2.)this.angularWidth_Array, (3.)this.cumulativeAngularWidth_Array, (4.)this.angularTickLabels_angularPosition_Array
            Visual.get_dateSpecificFilterVM_thenSetFollowing_cumulativeAngularWidth_angularTickLabels_angularPosition_Array(Visual.riskDateSelectedFactorValue, radialAxis_1_weight, radialAxis_2_weight, radialAxis_3_weight, radialAxis_4_weight);
            
            
            /*
            //this.viewModel.riskBubbles = this.viewModel.riskBubbles.filter(function f(value, index, self){ return value.factorized_riskDate == 1 ; }); //&& operator also works
            //caluclate angularWeight for each angular sector
            for (let angularAxisFactorItem_index in this.angularAxisFactorLevels){ //angularAxisFactorItem_index is number
                
                let currentAngularAxisName = this.angularAxisFactorLevels[angularAxisFactorItem_index];
                console.log("**", angularAxisFactorItem_index, currentAngularAxisName);
                this.angularWeight_Array[angularAxisFactorItem_index] = 
                                                radialAxis_1_weight * this.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.factorized_radialAxis == 1; }).length
                                                + radialAxis_2_weight * this.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.factorized_radialAxis == 2; }).length
                                                + radialAxis_3_weight * this.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.factorized_radialAxis == 3; }).length
                                                + radialAxis_4_weight * this.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.factorized_radialAxis == 4; }).length;

            if(this.angularWeight_Array[angularAxisFactorItem_index] == 0)
                    this.angularWeight_Array[angularAxisFactorItem_index] = 3 * 1; //In some cases, angular Axis like Risk Owner names contain non-english characters and hence are assigned angle = 0 and hence angularWidth = 0, so their risk bubbles just show up at origin.
            
            }
            //get totalAngularWeight based on each sector's angularWeight
            this.totalAngularWeight = this.angularWeight_Array.reduce(function getSum(total, value, index, array){ return total + value});  //https://www.w3schools.com/js/tryit.asp?filename=tryjs_es5_array_reduce
            
            //once totalAngularWeight is calculated, now calculate the angularWidth_Array
            for (let angularAxisFactorItem_index in this.angularAxisFactorLevels){ // 0-based angularAxisFactorItem_index is number in string type
                let currentAngularAxisName = this.angularAxisFactorLevels[angularAxisFactorItem_index];
                
                console.log("***", angularAxisFactorItem_index, this.angularWeight_Array[angularAxisFactorItem_index], this.totalAngularWeight );
                this.angularWidth_Array.push(Math.abs( (360 *  this.angularWeight_Array[angularAxisFactorItem_index] )/ this.totalAngularWeight )); //SAFE: Math.floor
            }
            //get cumulative Angular Width for each angular Axis. get positions of each angular tick labels.
            for (let angularAxisFactorItem_index in this.angularAxisFactorLevels){ //0-based angularAxisFactorItem_index is number in string type
                if(angularAxisFactorItem_index == "0"){
                    this.cumulativeAngularWidth_Array[angularAxisFactorItem_index] = 0;
                    this.angularTickLabels_angularPosition_Array[angularAxisFactorItem_index] = Math.abs(this.angularWidth_Array[angularAxisFactorItem_index] / 2 );
                }
                else{
                    this.cumulativeAngularWidth_Array[angularAxisFactorItem_index] = Math.abs(this.angularWidth_Array[parseInt(angularAxisFactorItem_index) - 1] + this.cumulativeAngularWidth_Array[parseInt(angularAxisFactorItem_index) -1] );
                    this.angularTickLabels_angularPosition_Array[angularAxisFactorItem_index] = Math.abs(this.angularWidth_Array[parseInt(angularAxisFactorItem_index)]/2) + Math.abs(this.cumulativeAngularWidth_Array[parseInt(angularAxisFactorItem_index)] );
                }
            }*/
            //ABOVE: Calculated following 4: Out of which 2 are finally used: 3.cumulativeAngularWidth_Array and 4.angularTickLabels_angularPosition_Array
            
            /*console.log("0.&&this.viewModel:==>", this.viewModel);
            console.log("1.&&angularWeight_Array", this.angularWeight_Array, "&&totalAngularWeight", this.totalAngularWeight);
            console.log("2.&&angularWidth_Array", this.angularWidth_Array);
            console.log("3.&&cumulativeAngularWidth_Array", this.cumulativeAngularWidth_Array);
            console.log("4.&&angularTickLabels_angularPosition_Array", this.angularTickLabels_angularPosition_Array);  
            */          

            //Process RiskBubbles Array to include Columns: 1. n_points, 2. risks_per_angularField, 3. angular_width 4. x_partition 5. y_partition, 6. x, 7. y, 8. angle
            Visual.set_plottingEssentialColumnsInViewModelRiskBubbles();
            
            /*
            this.start_CoordinateRange_x = this.offset;
            this.end_CoordinateRange_x = 1 - this.offset;
            this.start_CoordinateRange_y = this.offset;
            this.end_CoordinateRange_y = 1 - this.offset;
            let n_points: number = 0, x_partition: number = 0, y_partition: number = 0, each_split: number = 0;

            let x_vector_data: Array<number> = [];
            let y_vector_data: Array<number> = [];

            //Process RiskBubbles Array to include Columns: 1. n_points, 2. risks_per_angularField, 3. angular_width 4. x_partition 5. y_partition, 6. x, 7. y, 8. angle
            for (let angularAxisFactorItem_index in this.angularAxisFactorLevels){ //0-based angularAxisFactorItem_index is number in string type: "0", "1", "2", "3", ..
                for (let radialAxisFactorItem_index in this.radialAxisFactorLevels){ //0-based radialAxisFactorItem_index is number in string type: "0", "1", "2", "3", ..
                    
                    let currentAngularAxisName = this.angularAxisFactorLevels[angularAxisFactorItem_index];
                    let currentRadialAxisName = this.radialAxisFactorLevels[radialAxisFactorItem_index];
                    this.riskPerAngularField = this.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName; }).length;

                    if( this.riskPerAngularField/this.totalNumberOfRisks > 2/6){  //CASE: Large amount(1/3rd of total) of risk are on that particular angular sector. So plot risks till the edge
                        this.offset = 0.1; //0.05
                        this.start_CoordinateRange_x = this.offset;
                        this.end_CoordinateRange_x = 1 - this.offset;
                      }
                      else if( this.riskPerAngularField/this.totalNumberOfRisks > 1/6){
                        this.offset = 0.15
                        this.start_CoordinateRange_x = this.offset;
                        this.end_CoordinateRange_x = 1 - this.offset;
                      }
                      else{
                        this.offset = 0.1
                        this.start_CoordinateRange_x = this.offset;
                        this.end_CoordinateRange_x = 1 - this.offset;
                      }
                    
                    this.start_CoordinateRange_y = 0.2;
                    this.end_CoordinateRange_y = 0.8;

                    n_points = this.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; }).length
                    if(n_points != 0){
                        x_partition = Math.ceil(Math.sqrt( n_points ));    
                        y_partition = Math.ceil( (n_points + 1)/x_partition );
                    }
                    else{
                        x_partition = 0;
                        y_partition = 0;
                    }

                    for (let index in this.viewModel.riskBubbles){ //0-based index is number in string type: "0", "1", "2", "3", ..
                        //console.log("index in viewModel.riskBubble:==>", index);
                        if(this.viewModel.riskBubbles[index].angularAxis == currentAngularAxisName && this.viewModel.riskBubbles[index].radialAxis == currentRadialAxisName){
                            this.viewModel.riskBubbles[index].n_points = n_points;
                            this.viewModel.riskBubbles[index].risks_per_angularField = this.riskPerAngularField;
                            this.viewModel.riskBubbles[index].angular_width = Math.abs( (360 *  this.angularWeight_Array[angularAxisFactorItem_index] )/ this.totalAngularWeight );
                            this.viewModel.riskBubbles[index].x_partition = x_partition;
                            this.viewModel.riskBubbles[index].y_partition = y_partition;
                        }
                    }
                    
                    if(x_partition == 1){
                        each_split = (this.end_CoordinateRange_x - this.start_CoordinateRange_x)/1;
                    }
                    else if(x_partition > 1){
                        each_split = (this.end_CoordinateRange_x - this.start_CoordinateRange_x)/(x_partition - 1);
                    }

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
                    if(n_points == 1)
                    {
                        x_vector_data = [0.5];y_vector_data = [0.5]
                    }

                    //let number_of_bubbles_in_angular_sector = this.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName  } ).length;  //nrow(risk_register_data[risk_register_data$angularAxis == angular_item , ] )
                    let number_of_bubbles_in_full_row = y_vector_data.indexOf(Math.min.apply(null, y_vector_data)); // https://stackoverflow.com/questions/1669190/find-the-min-max-element-of-an-array-in-javascript //match(min(y_vector_data), y_vector_data) - 1 //SAFE: match(0.2, vector) gives index of first 0.2 found.
                    let number_of_bubbles_in_last_row = n_points - number_of_bubbles_in_full_row
                    let improved_x_vector_data = null;

                    if(number_of_bubbles_in_last_row > 0 && number_of_bubbles_in_last_row < 2){
                    //if(number_of_bubbles_in_last_row > 100000 && number_of_bubbles_in_last_row < 200000){ //number_of_bubbles_in_angular_sector < 10)
                        improved_x_vector_data = x_vector_data.slice(0, number_of_bubbles_in_full_row).concat( this.seq(this.start_CoordinateRange_x, this.end_CoordinateRange_x, number_of_bubbles_in_last_row + 2).slice(1, number_of_bubbles_in_last_row + 1) );  //c(x_vector_data[1:number_of_bubbles_in_full_row], seq(start_CoordinateRange_x, end_CoordinateRange_x, length.out = number_of_bubbles_in_last_row + 2)[-c(1, number_of_bubbles_in_last_row + 2)]  )
                    }
                    else{
                        improved_x_vector_data = x_vector_data
                    }

                    //console.log("improved_x_vector_data:==>", improved_x_vector_data);
                    for(let i:number = 0; i < n_points; i++){ //  in 1:nrow(risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, ] )) {
                        //risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "x"][i] <- improved_x_vector_data[i] + risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "angularAxis"][i] - 1.0  #- 0.5
                        this.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; })[i].x = improved_x_vector_data[i] + this.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; })[i].factorized_angularAxis - 1.0;
                        //risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "y"][i] <- y_vector_data[i] + risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "radialAxis"][i] #-0.5
                        this.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; })[i].y = y_vector_data[i] + this.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; })[i].factorized_radialAxis;
                        //#SAFE: risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "angle"][i] <- as.integer( (x_vector_data[i] + risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "angularAxis"][i] - 1.0)*(360/number_of_sectors) ) 
                        //risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "angle"][i] <- as.integer( (improved_x_vector_data[i])* as.integer(angularWidth_list[as.integer(angular_item)]) + as.integer(cumulative_angularWidth_list[as.integer(angular_item)])) 
                        this.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; })[i].angle = ( (improved_x_vector_data[i]) * parseFloat(this.angularWidth_Array[parseInt(angularAxisFactorItem_index)]) + parseFloat(this.cumulativeAngularWidth_Array[parseInt(angularAxisFactorItem_index)])); //y_vector_data[i] + viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; })[i].factorized_radialAxis;
                    }
                    console.log(">>>>>>>>>>>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<<<")
                }
            }*/
            //let bubble_size_upperlimit_factor = (0.6 + (0.4 * 6 * Bubble_bubbleSize_selection)/(number_of_sectors * 50)) #default value Bubble_bubbleSize_selection = 50
            //let bubble_size_upperlimit_factor = (0.6 + (0.4 * 6 * Bubble_bubbleSize_selection)/(number_of_sectors * 50)) //default value Bubble_bubbleSize_selection = 50


            //////=======END: DATA WRANGLING:======\\\\\\\////////
            
            /*console.log("**this.viewModel:==>", this.viewModel);
            console.log("**this.sentinelChartTitle", this.sentinelChartTitle);
            console.log("**this.angularWeight_Array:==>", this.angularWeight_Array);
            console.log("**this.angularTickLabels_angularPosition_Array:==>", this.angularTickLabels_angularPosition_Array);
            console.log("**this.angularWidth_Array:==>", this.angularWidth_Array);
            console.log("**this.cumulativeAngularWidth_Array:==>", this.cumulativeAngularWidth_Array);
            */
            //////=======START: CHART PLOTTING:======\\\\\\\////////

            let lowSize = 4
            let mediumSize = 6
            let highSize = 8
            let veryHighSize = 10

            this.svgContainer.selectAll(".template_textInstructionsGroup").remove();
            this.svgContainer.selectAll(".template_radialAxisGroupClass").remove();
            //this.svgContainer.selectAll("g").remove();

            width = options.viewport.width;
            height = options.viewport.height;

            if(this.settings.playAxis.show.value == true){
                outerMostRadialAxisRadius = Math.min(width, height) / 2 - 60; // radius of the whole chart //SAFE: -30 without play axis.
            }
            else
            outerMostRadialAxisRadius = Math.min(width, height) / 2 - 30; // radius of the whole chart //SAFE: -30 without play axis.
            //let outerMostRadialAxisRadius = Math.min(options.viewport.width, options.viewport.height) / 2 - 50; // radius of the whole chart //SAFE: -30

            this.svgContainer
            .style("background-color", "white") //"azure"
            .attr({
                width: width,
                height: height,
                "outerRadiusDummy": outerMostRadialAxisRadius
            });

             //**START: PLAY AXIS */
             let formatDateIntoYear = d3.time.format("%Y"); //d3.timeFormat("%Y");
             let formatDateIntoMonthYear = d3.time.format("%b %Y"); //d3.timeFormat("%Y");
             let formatDate = d3.time.format("%b %Y"); //d3.timeFormat("%b %Y");
             let formatDateIntoDayMonthYear = d3.time.format("%d %b %Y"); //d3.timeFormat("%b %Y");
             let parseDate = d3.time.format("%m/%d/%y"); //d.date = parseDate.parse(d.date);  //d3.timeParse("%m/%d/%y");
             
             let sliderStartDate = new Date(Visual.viewModel_wholePeriod.riskBubbles[0].riskDateMilliseconds); //new Date("2010-01-01");
             let sliderEndDate = new Date(Visual.viewModel_wholePeriod.riskBubbles[ Visual.viewModel_wholePeriod.riskBubbles.length - 1].riskDateMilliseconds); //new Date("2015-01-01");
             console.log("sliderStartDate, sliderEndDate:==>", sliderStartDate, sliderEndDate);
 
             //Visual.moving = false;
             //Visual.currentValue = 0; //"2018-12-31T18:30:00.000Z"; //0;
             Visual.targetValue = width - 100; //SAFE: 100

             //var timer = 0;
             let moving = Visual.moving; //false;
             let currentValue = Visual.currentValue; //0;
             let targetValue = width - 100;
             let monthSteps = 1; //2 for six-months, 4 for each quaters
             //let incrementBy = targetValue/((sliderEndDate.getFullYear() - sliderStartDate.getFullYear())*monthSteps); //targetValue/50;
             //let incrementBy = targetValue/((sliderEndDate.getMonth() - sliderStartDate.getMonth())*monthSteps); //targetValue/50;
             let incrementBy = targetValue/((sliderEndDate.getTime() - sliderStartDate.getTime()) / (30 * 24 * 60 * 60 * 1000) * monthSteps); //targetValue/50;
             let currentValue_settledDuringClickDragnDrop = 0; //Math.round(currentValue/incrementBy) * incrementBy;

             let x_playAxisScale = d3.time.scale()  //d3.scaleTime()
                    .domain([sliderStartDate, sliderEndDate])
                    .range([0, Visual.targetValue])
                    .clamp(true);
            let x_locationsOfTicks = [];
            let i = 0;
            for(; i <  x_playAxisScale.ticks(sliderEndDate.getMonth() - sliderStartDate.getMonth()).length; i++){
                x_locationsOfTicks[i] = x_playAxisScale(x_playAxisScale.ticks(sliderEndDate.getMonth() - sliderStartDate.getMonth())[i]);
            }

            console.log("x_locationsOfTicks:==>", x_locationsOfTicks);
            //console.log("sliderEndDate.getMonth(), sliderStartDate.getMonth(), x_playAxisScale.ticks(sliderEndDate.getMonth() - sliderStartDate.getMonth()):==>", sliderEndDate.getMonth(), sliderStartDate.getMonth(), x_playAxisScale.ticks(sliderEndDate.getMonth() - sliderStartDate.getMonth()));
 
             //Removing all the slider object here will help while resizing.
             this.svgContainer.selectAll(".track").remove();
             this.svgContainer.selectAll(".track-inset").remove();
             this.svgContainer.selectAll(".track-overlay").remove();
             this.svgContainer.selectAll(".tickLabels").remove();
             this.svgContainer.selectAll(".tickMarks").remove();
             this.svgContainer.selectAll(".labelStart").remove();
             this.svgContainer.selectAll(".labelEnd").remove();
             this.svgContainer.selectAll(".handle").remove();

             this.svgContainer.selectAll(".playPauseButton").remove();
             this.svgContainer.selectAll(".playPauseTextClass").remove();
             
             //this.svgContainer.selectAll(".playPauseButton").remove();
             //this.svgContainer.selectAll(".playPauseTextClass").remove();
            //this.svgContainer.selectAll(".slider").select("*").remove();
             
            if(this.settings.playAxis.show.value == true){
                console.log("<=========PLOT THE SLIDER=====>", Visual.riskDateSelectedFactorValue);

                //console.log("incrementBy, number of splits", incrementBy, targetValue/incrementBy);
                //SLIDER LINE
                this.slider.attr("transform", "translate(" + 70 + "," + (height - 35) + ")"); //Earlier: height - 50
                this.slider.append("line")
                    .attr("class", "track")
                    .attr("x1", x_playAxisScale.range()[0])
                    //.attr("x2", x_playAxis.range()[1])
                    .attr("x2", Visual.targetValue)
                    .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
                    .attr("class", "track-inset")
                    .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
                    .attr("class", "track-overlay")
                    // HELPFUL LINK: https://bl.ocks.org/puzzler10/9159a992f58aa4277c2583fa41f01ed0
                    .call(
                        d3.behavior.drag().on("drag", function(d){
                            //currentValue = d3.event["x"] <= targetValue ? d3.event["x"] : targetValue;
                            currentValue = d3.event["x"] >= 0 ? (d3.event["x"] <= targetValue ? d3.event["x"] : targetValue) : 0;
                            //console.log("************************", currentValue, d3.event["x"], formatDate(x_playAxisScale.invert(currentValue) ) );
                            //d3.select(".handle").attr("cx", d3.event["x"]);
                            if(d3.select(".playPauseTextClass").text() == "Reset" && currentValue != targetValue){
                                d3.select(".playPauseTextClass").text("Play");
                                currentValue = d3.event["x"];
                            }
                            if(d3.event["x"] == targetValue){
                                d3.select(".playPauseTextClass").text("Reset");
                            }
                            currentValue_settledDuringClickDragnDrop = x_locationsOfTicks[ Math.round(currentValue/incrementBy) ];
                            console.log("--------riskDate FactorValue--------", Math.floor(currentValue_settledDuringClickDragnDrop/incrementBy) + 1);
                            
                            //REMOVE: Visual.viewModel =    Visual.getViewModel(options); //this.viewModel;
                            //REMOVE: Visual.viewModel.riskBubbles = JSON.parse(JSON.stringify(Visual.viewModel_wholePeriod.riskBubbles));
                            //Visual.viewModel.riskBubbles = [...Visual.viewModel_wholePeriod.riskBubbles];
                            console.log("Visual.viewModel.riskBubbles:==>", Visual.viewModel.riskBubbles);
                            Visual.get_dateSpecificFilterVM_thenSetFollowing_cumulativeAngularWidth_angularTickLabels_angularPosition_Array(Math.floor(currentValue_settledDuringClickDragnDrop/incrementBy) + 1, radialAxis_1_weight, radialAxis_2_weight, radialAxis_3_weight, radialAxis_4_weight);
                            Visual.set_plottingEssentialColumnsInViewModelRiskBubbles();

                            d3.select(".handle").transition().duration(200).attr("cx", currentValue_settledDuringClickDragnDrop); //.attr("cx", x_playAxisScale( x_playAxisScale.invert(currentValue) ));
                            d3.select(".labelStart").transition().duration(200).text(formatDate(x_playAxisScale.invert(currentValue_settledDuringClickDragnDrop) )).attr("x", x_playAxisScale( x_playAxisScale.invert(currentValue_settledDuringClickDragnDrop) )) //.attr("transform", "translate(" + currentValue.toString() + "," + (-25) + ")")
                            if(currentValue == targetValue){
                                d3.select(".playPauseTextClass").text("Reset");
                            }
                        })
                    )

                    //.on("click", function(d){
                    .on("click", (d, i) => {
                        //currentValue = d3.event["x"] <= targetValue ? d3.event["x"] : targetValue;
                        currentValue = d3.event["x"] >= 0 ? (d3.event["x"] <= targetValue ? d3.event["x"] : targetValue) : 0;
                        //console.log("************************", currentValue, d3.event["x"], formatDate(x_playAxisScale.invert(currentValue) ) );
                        //d3.select(".handle").attr("cx", d3.event["x"]);
                        if(d3.select(".playPauseTextClass").text() == "Reset" && currentValue != targetValue){
                            d3.select(".playPauseTextClass").text("Play");
                            currentValue = d3.event["x"];
                        }
                        if(d3.event["x"] == targetValue){
                            d3.select(".playPauseTextClass").text("Reset");
                        }
                        //Visual.viewModel.riskBubbles = JSON.parse(JSON.stringify(Visual.viewModel_wholePeriod.riskBubbles));
                        //currentValue_settledDuringClickDragnDrop = Math.round(currentValue/incrementBy) * incrementBy;
                        currentValue_settledDuringClickDragnDrop = x_locationsOfTicks[ Math.round(currentValue/incrementBy) ];

                        Visual.currentValue = currentValue_settledDuringClickDragnDrop;
                        Visual.riskDateSelectedFactorValue = Math.floor(currentValue_settledDuringClickDragnDrop/incrementBy) + 1;
                        console.log("--------riskDate FactorValue Selected--------", Visual.riskDateSelectedFactorValue);
                        this.update(options);
                        
                        //console.log("************Visual.viewModel***********", Visual.viewModel.riskBubbles);
                        
                        //Visual.get_dateSpecificFilterVM_thenSetFollowing_cumulativeAngularWidth_angularTickLabels_angularPosition_Array(Visual.riskDateSelectedFactorValue, radialAxis_1_weight, radialAxis_2_weight, radialAxis_3_weight, radialAxis_4_weight);
                        //Visual.set_plottingEssentialColumnsInViewModelRiskBubbles();

                        d3.select(".handle").transition().duration(500).attr("cx", currentValue_settledDuringClickDragnDrop); //.attr("cx", x_playAxisScale( x_playAxisScale.invert(currentValue) ));
                        d3.select(".labelStart").transition().duration(500).text(formatDate(x_playAxisScale.invert(currentValue_settledDuringClickDragnDrop) )).attr("x", x_playAxisScale( x_playAxisScale.invert(currentValue_settledDuringClickDragnDrop) )) //.attr("transform", "translate(" + currentValue.toString() + "," + (-25) + ")")
                        if(currentValue == targetValue){
                            d3.select(".playPauseTextClass").text("Reset");
                        }
                    })
                ;
                
                //TICK LABELS
                this.slider.insert("g", ".track-overlay")
                    .attr("class", "tickLabels")
                    .attr("transform", "translate(0," + 25 + ")")
                    .selectAll("text")
                    //.data(x_playAxisScale.ticks(sliderEndDate.getFullYear() - sliderStartDate.getFullYear() ))
                    .data(x_playAxisScale.ticks(sliderEndDate.getMonth() - sliderStartDate.getMonth() ))
                    .enter()
                    .append("text")
                    .attr("x", x_playAxisScale)
                    .attr("y", 10)
                    .attr("text-anchor", "middle")
                    .style("font-size", this.settings.playAxis.tickLabelFontSize.value)
                    .style("fill", this.settings.playAxis.tickLabelFontColor.value)
                    .text(function(d) { /*return d.toString();*/ return formatDateIntoMonthYear(d); });
                
                //TICK MARKS
                this.slider.insert("g", ".track-overlay")
                    .attr("class", "tickMarks")
                    .attr("transform", "translate(0," + 10 + ")")
                    .selectAll("text")
                    //.data(x_playAxisScale.ticks((sliderEndDate.getFullYear() - sliderStartDate.getFullYear())*monthSteps ))  //Quaterly ticks
                    .data(x_playAxisScale.ticks((sliderEndDate.getMonth() - sliderStartDate.getMonth())*monthSteps ))  //Quaterly ticks
                    .enter()
                    .append("line")
                    .attr("x1", x_playAxisScale)
                    .attr("y1", -5)
                    .attr("x2", x_playAxisScale)
                    .attr("y2", function(d, i){ if((i + 1)%monthSteps == 0) return 5; else return 3;})
                    .attr("stroke", "grey")
                    .attr("stroke-width", function(d, i){ if((i + 1)%monthSteps == 0) return 2; else return 0.5;})
    
                    .attr("text-anchor", "middle")
                    //.text(function(d) { /*return d.toString();*/ return formatDateIntoMonthYear(d); })
                    ;
                
                this.handle = this.slider.insert("circle", ".track-overlay")
                    .attr("class", "handle")
                    .attr("cx", Visual.currentValue)//.attr("cx", x_playAxisScale(new Date(2016, 1, 1)))
                    .attr("r", 9);
                
                //Anyways, playPause button is disabled. If all dates are same, then remove slider handle.
                /*if(sliderStartDate != sliderEndDate){
                    this.handle.remove();
                }*/

                this.labelStart = this.slider.append("text")  
                    .attr("class", "labelStart")
                    .attr("text-anchor", "middle")
                    .attr("x", Visual.currentValue)
                    //.text(this.formatDate(sliderStartDate))
                    .text(formatDate(x_playAxisScale.invert(Visual.currentValue) ))//.attr("x", x_playAxisScale( x_playAxisScale.invert(currentValue_settledDuringClickDragnDrop) ))
                    .style("font-size", this.settings.playAxis.tickLabelFontSize.value)
                    .style("fill", this.settings.playAxis.tickLabelFontColor.value)
                    .attr("transform", "translate(0," + (-25) + ")");
                /*this.labelEnd = this.slider.append("text")  
                    .attr("class", "labelEnd")
                    .attr("text-anchor", "middle")
                    .text(this.formatDate(sliderEndDate))
                    .style("font-size", this.settings.playAxis.tickLabelFontSize.value)
                    .style("fill", this.settings.playAxis.tickLabelFontColor.value)
                    .attr("transform", "translate(" + this.targetValue.toString() + "," + (-25) + ")")
                */
                //this.dataset = [{"id": 1, "date":"2018-12-31T18:30:00.000Z"}, {"id": 1, "date": "2018-12-31T18:30:00.000Z"}, {"id": 1, "date": "2018-12-31T18:30:00.000Z"}, {"id": 1, "date": "2018-12-31T18:30:00.000Z"}, {"id": 1, "date": "2018-12-31T18:30:00.000Z"}];//this.datesArray;
                //let dataset = [{"id": 1, "date": "1/1/2019"}, {"id": 1, "date": "2/1/2019"}, {"id": 1, "date": "3/1/2019"}, {"id": 1, "date": "4/1/2019"}, {"id": 1, "date": "5/1/2019"}];//this.datesArray;
    
                let playButtonCircle = this.slider.append("circle").classed("playPauseButton", true) //d3.select(".playPauseButton") //this.slider.append("circle").classed("playPauseButton", true)//SAFE: d3.select(".playPauseButton")
                    .attr({
                        cx: -50, //SAFE: When sibling of .slider: 35
                        cy: 0, //SAFE: When sibling of .slider: height - 50,
                        r: 15,
                        stroke: "grey",
                        fill: "#FAFAFA", //lightgrey
                    });
    
                let playButtonText = this.slider.append("text").classed("playPauseTextClass", true) //this.slider.append("text").classed("playPauseTextClass", true) //SAFE: d3.select(".playPauseTextClass")
                    .text(Visual.currentValue < targetValue ? (Visual.moving == false ? "Play" : "Pause") : "Reset")
                    .style("fill", "blue")
                    .style("font-size", 10)
                    .attr({
                        x: -50 - 1, //SAFE: When sibling of .slider: 40 - 4,
                        y: 2, //SAFE: When sibling of .slider: height - 50 + 2,
                        stroke: "grey",
                        "text-anchor": "middle"
                    })
                    //.on('click', function(){
                    .on("click", (d, i) => {
                        if(playButtonText.text() == "Play"){
                            playButtonText.text("Pause");
                            moving = false; Visual.moving = moving;
                            console.log("Play clicked");
                        }
                        else if(playButtonText.text() == "Pause"){
                            playButtonText.text("Play");
                            moving = true; Visual.moving = moving;
                            console.log("Pause clicked");
                        }
                    });
    
                var THAT = this;
                playButtonText
                    //.on("click", function() {
                    .on("click", (d, i) => {
                        //console.log("Debug: 561: currentValue, targetValue, incrementBy, moving:==>", currentValue, targetValue, incrementBy, moving);
                        console.log("===>sliderStartDate, sliderEndDate:==>", sliderStartDate, sliderEndDate);
                        //var button = d3.select(this);

                        //If all the dates are same, do nothing and return. Already, slider handle is removed.
                        if (sliderStartDate.getTime() == sliderEndDate.getTime()){
                            console.log("START and END date same!!");
                            return null;
                        }
                        else if (playButtonText.text() == "Pause") {
                            console.log("Pause Clicked: x/currentValue, text, moving====>", x_playAxisScale( x_playAxisScale.invert(currentValue) ), playButtonText.text(), moving);
                            playButtonText.text("Play");
                            moving = false; Visual.moving = moving;
                            clearInterval(Visual.timer);
                            // timer = 0;
                        } 
                        else if(playButtonText.text() == "Reset" && currentValue !=0){//CASE: text is "Reset" and now clicked.
                            currentValue = 0; Visual.currentValue = currentValue;
                            Visual.riskDateSelectedFactorValue = Math.floor(currentValue/incrementBy) + 1;
                            d3.select(".handle").transition().duration(200).attr("cx", x_playAxisScale( x_playAxisScale.invert(currentValue) ));//.transition().duration(1000)
                            d3.select(".labelStart").transition().duration(200).attr("x", x_playAxisScale( x_playAxisScale.invert(currentValue) )).text(formatDate(sliderStartDate));
                            //d3.select(".labelEnd").text(formatDateIntoMonthYear(sliderEndDate));
                            playButtonText.text("Play");
                            this.update(options);
                        }
                        else { //CASE: playButtonText.text() == "Play"
                            if(currentValue > targetValue){
                                currentValue = 0; Visual.currentValue = currentValue;
                                d3.select(".handle").transition().duration(1000).attr("cx", x_playAxisScale( x_playAxisScale.invert(currentValue) ));//.transition().duration(1000)
                            }

                            moving = true; Visual.moving = moving;
                            console.log("Play clicked");
                            playButtonText.text("Pause");
                            Visual.timer = setInterval(
                                function(){
                                    console.log("Play Clicked: x/currentValue, text, moving====>", x_playAxisScale( x_playAxisScale.invert(currentValue) ), playButtonText.text(), moving);
                                    d3.select(".handle").transition().duration(200).attr("cx", x_playAxisScale( x_playAxisScale.invert(currentValue) ));
                                    d3.select(".labelStart").transition().duration(200).attr("x", x_playAxisScale( x_playAxisScale.invert(currentValue) ))
                                    //.text(formatDateIntoDayMonthYear( x_playAxisScale.invert(currentValue) ))
                                    .text(formatDateIntoMonthYear( x_playAxisScale.invert(currentValue) ))
                                    if(currentValue < targetValue){
                                        currentValue += incrementBy; 
                                        currentValue = x_locationsOfTicks[ Math.round(currentValue/incrementBy) ]; 
                                        Visual.currentValue = currentValue;

                                        Visual.riskDateSelectedFactorValue = Math.floor(currentValue/incrementBy) + 1;
                                        THAT.update(options);
                                    }
                                    else{
                                        moving = false; Visual.moving = moving; 
                                        playButtonText.text("Reset");
                                        clearInterval(Visual.timer);
                                    }
                                }, 3000);  //SAFE: 100
                        }
                    console.log("===>Slider moving: " + moving);
                });
            
            }  //CLOSE: if(this.settings.playAxis.show.value)
 
             //**END: PLAY AXIS */
 
            
            
            let radialAxisScale = d3.scale.linear()
            .domain([0, 5])  //5 because total 5 concentric circles
            .range([0, outerMostRadialAxisRadius]);   

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
                .data(Visual.radialAxisTickLabelsArray)
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
                .data(Visual.radialAxisTickLabelsArray)
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
                .data(Visual.cumulativeAngularWidth_Array)
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
            let global_angularAxisFactorLevels = Visual.angularAxisFactorLevels;  //Because inside this.angularAxisTicksGroup's text(anonymous function) you can't access another this.<something> object
            this.angularAxisTicksGroup
                //.selectAll(".angularAxisTickGroupClass")
                .selectAll("angularAxisTicks")
                .data(Visual.angularTickLabels_angularPosition_Array)
                //.style("font-size", 12)
                //.style("font-size", this.settings.axis.angularAxis.labelFontSize.value)
                //.style("fill", this.settings.axis.angularAxis.labelFontColor.value)
                .enter()
                .append("g")
                .classed("angularAxisTickClass", true)
                .style("font-size", this.settings.axis.angularAxis.labelFontSize.value)
                .style("fill", this.settings.axis.angularAxis.labelFontColor.value)
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
                   dx: function(d) { return d > 180 && d < 360 ? "-1.5em" : "1.5em"; },
                   dy: function(d) { return d > 135 && d <= 220 ? "1em" : "0em"; },
                   //dy: function(d) { return d > 180 && d < 360 ? "0.5em" : "0em"; },
                   x: function(d, index){ return Math.abs(width/2) +  radialAxisScale(5) * Math.cos( (1 * Math.PI * (270 + d))/180); },
                   y: function(d, index){ return Math.abs(height/2) +  radialAxisScale(5) * Math.sin( (1 * Math.PI * (270 + d))/180); },
                   dummyAngle: function(d, index){return d;}
                })
                //BELOW .text() WORKING GOOD
                .text(function(d, i){ //console.log("--", d, i, global_angularAxisFactorLevels);
                    return global_angularAxisFactorLevels[i];
                })
                /*1.TESTING BELOW
                //.append("tspan")
                .attr({
                    dy: "1em",
                    x: function(d, index){ return Math.abs(width/2) +  radialAxisScale(5) * Math.cos( (1 * Math.PI * (270 + d))/180); }
                })*/
                //.html("<tspan dy = 1em>A </tspan><tspan  dy=1em>B </tspan>")
                /*2. TESTING BELOW
                */
                
                
                .on('click',(d, i) => {
                    Visual.isAngularAxisDrilledDown = true;
                    Visual.angularAxisSelected = global_angularAxisFactorLevels[i];
                    console.log("Angular Label clicked:==>Visual.angularAxisSelected,  Visual.isAngularAxisDrilledDown?:==>", Visual.angularAxisSelected, ",", Visual.isAngularAxisDrilledDown);
                    //console.log("options:==>", Visual.update(options));
                    //this.viewModel = this.getViewModelDrillDown(options, Visual.angularAxisSelected);

                    this.update(options);
                    //this.drillDown(options); //drilldown comes as undefined function.
                });
                

            //PARENT LABEL
            let showSentinelChartTitle_flag = this.settings.parentLabel.show.value;
            let sentinelChartTitle = Visual.sentinelChartTitle;
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
                /*WORKING .text
                .text(function(d, i){ //console.log("********************", showSentinelChartTitle_flag, sentinelChartTitle);
                    if(showSentinelChartTitle_flag == true) return sentinelChartTitle; else return ""; 
                })
                */
                .html(function(d, i){ //console.log("********************", showSentinelChartTitle_flag, sentinelChartTitle);
                if(showSentinelChartTitle_flag == true) {
                    let hold: string = "";
                    
                    let split_array = sentinelChartTitle.trim().split(" ");
                    let start_from = Math.floor(split_array.length / 2); // for n=1=> 0 | n=2=>-1,0 | n=3=>-1,0,1 | n=4=>-2,-1,0,1 | n=5=>-2,-1,0,1,2
                    for(let i=0; i<split_array.length; i++){
                        hold += "<text dy=\""+ (-1 * start_from + i) + "em\" x=" + Math.abs(width/2) + " y=" + Math.abs(height/2)+ ">" + split_array[i] + "</text>"
                    }
                    return hold; 
                    }
                else return ""; 
                })
                /*.on('click', function(d,i){
                    console.log("Parent Label Clicko clicked:==>_, isClicked?", Visual.angularAxisSelected, "/", Visual.isAngularAxisDrilledDown);
                })*/
                .on('click',(d, i) => {
                    Visual.isAngularAxisDrilledDown = false;
                    Visual.angularAxisSelected = null; //global_angularAxisFactorLevels[i];
                    console.log("Parent Label Clicko clicked:==>_, isClicked?", Visual.angularAxisSelected, "/", Visual.isAngularAxisDrilledDown);
                    this.update(options);

                })
                ;


            
            //RISK BUBBLE CIRCLES
            let green = this.settings.riskBubble.greenColor.value;
            let amber = this.settings.riskBubble.amberColor.value;
            let red = this.settings.riskBubble.redColor.value;
            let bubbleSize_selection = Math.abs(Math.abs(this.settings.riskBubble.bubbleSize.value)); //default value 50%

            /*SAFE: WORKING: RISK BUBBLE CIRCLES and RISK BUBBLE LABELS
            this.riskBubblesGroup
                .selectAll(".riskBubbles")
                .data(Visual.viewModel.riskBubbles)
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

                    Visual.host.tooltipService.show({
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

                    Visual.host.tooltipService.move({
                        dataItems: d.tooltips,
                        identities: [d.identity],
                        coordinates: [x, y],
                        isTouchEvent: false
                    });
                })
                .on("mouseout", (d) => {
                    Visual.host.tooltipService.hide({
                        immediately: true,
                        isTouchEvent: false
                    });
                })
                //.transition()
                //.duration(500)
                //.ease(d3.easeLinear)
                //.attr("r", 5)
                ;
                
            //RISK BUBBLES LABEL
            let redColorLabel = this.settings.riskBubble.redColorLabel.value;
            let amberColorLabel = this.settings.riskBubble.amberColorLabel.value;
            let greenColorLabel = this.settings.riskBubble.greenColorLabel.value;

            this.riskBubblesGroup
            .selectAll(".riskBubbles")
            .data(Visual.viewModel.riskBubbles)
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
            //.style("font-size", 10)
            .style("font-size", this.settings.riskBubble.labelFontSize.value)
            .style("text-anchor", "middle")
            .attr({
                "transform": function(d, index){let coors = (Math.abs(width/2) + radialAxisScale(d.y) * Math.cos((1 * Math.PI * (270 + d.angle))/180)).toString() + "," + (Math.abs(height/2) + radialAxisScale(d.y) * Math.sin((1 * Math.PI * (270 + d.angle))/180)).toString(); return 'translate(' + coors + ')';},
                dy: "0.2em"
                })
            .text(function(d, i){  return d.bubbleLabel;}) 
            //SAFE: .on("mouseover", (d) => {
                .on("mouseover", (d) => {
                    let mouse = d3.mouse(this.svgContainer.node());
                    let x = mouse[0];
                    let y = mouse[1];
    
                    Visual.host.tooltipService.show({
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
    
                    Visual.host.tooltipService.move({
                        dataItems: d.tooltips,
                        identities: [d.identity],
                        coordinates: [x, y],
                        isTouchEvent: false
                    });
                })
                .on("mouseout", (d) => {
                    Visual.host.tooltipService.hide({
                        immediately: true,
                        isTouchEvent: false
                    });
                });
    
                */

            this.riskBubblesGroup
                .selectAll(".riskBubbles")
                //.data(Visual.viewModel.riskBubbles)
                .data(Visual.bubblesDetailsObject["bubblesTransitionLocationsArray"])
                .enter()
                .append("circle")
                .classed("riskBubblesClass", true)
                .attr({
                    "transform": function(d, index){let coors = (Math.abs(width/2) + radialAxisScale(d["y_" + (Visual.riskDateSelectedFactorValue - 1).toString()]) * Math.cos((1 * Math.PI * (270 + d["angle_" + (Visual.riskDateSelectedFactorValue - 1).toString()]))/180)).toString() + "," + (Math.abs(height/2) + radialAxisScale(d["y_" + (Visual.riskDateSelectedFactorValue - 1).toString()]) * Math.sin((1 * Math.PI * (270 + d["angle_" + (Visual.riskDateSelectedFactorValue - 1).toString()]))/180)).toString(); return 'translate(' + coors + ')';},
                    //"r": 8,
                    "r": function(d, index){
                        if(d["factorized_bubbleSize_" + (Visual.riskDateSelectedFactorValue - 1).toString()] == 1)
                            return  lowSize * (bubbleSize_selection/50);
                        else if(d["factorized_bubbleSize_"  + (Visual.riskDateSelectedFactorValue - 1).toString()] == 2)
                            return mediumSize * (bubbleSize_selection/50);
                        else if(d["factorized_bubbleSize_" + (Visual.riskDateSelectedFactorValue - 1).toString()] == 3)
                            return highSize * (bubbleSize_selection/50);
                        else if(d["factorized_bubbleSize_" + (Visual.riskDateSelectedFactorValue - 1).toString()] == 4)
                            return veryHighSize * (bubbleSize_selection/50);
                    },
                    "fill": function(d, index){ //private bubble_colors_map = ["#FF0000"/RED, "#FFC000"/AMBER, "#00AC50"/GREEN]
                        if(d["factorized_bubbleColor_" + (Visual.riskDateSelectedFactorValue - 1).toString()] == 1)
                            return red; //return "#FF0000"; //this.RED_COLOR;
                        else if(d["factorized_bubbleColor_" + (Visual.riskDateSelectedFactorValue - 1).toString()] == 2)
                            return amber;   //return "#FFC000"; //this.AMBER_COLOR;
                        else if(d["factorized_bubbleColor_" + (Visual.riskDateSelectedFactorValue - 1).toString()] == 3)
                            return green;   //return "#00AC50"; //this.GREEN_COLOR;
                    },
                    "dummyAngle": function(d, index){return d["angle_" + (Visual.riskDateSelectedFactorValue - 1).toString()];}
                    
                })
                .transition()
                .duration(1800)
                .attr({
                    "transform": function(d, index){let coors = (Math.abs(width/2) + radialAxisScale(d["y_" + (Visual.riskDateSelectedFactorValue).toString()]) * Math.cos((1 * Math.PI * (270 + d["angle_" + (Visual.riskDateSelectedFactorValue).toString()]))/180)).toString() + "," + (Math.abs(height/2) + radialAxisScale(d["y_" + (Visual.riskDateSelectedFactorValue).toString()]) * Math.sin((1 * Math.PI * (270 + d["angle_" + (Visual.riskDateSelectedFactorValue).toString()]))/180)).toString(); return 'translate(' + coors + ')';},
                    //"r": 8,
                    "r": function(d, index){
                        if(d["factorized_bubbleSize_" + (Visual.riskDateSelectedFactorValue).toString()] == 1)
                            return  lowSize * (bubbleSize_selection/50);
                        else if(d["factorized_bubbleSize_"  + (Visual.riskDateSelectedFactorValue).toString()] == 2)
                            return mediumSize * (bubbleSize_selection/50);
                        else if(d["factorized_bubbleSize_" + (Visual.riskDateSelectedFactorValue).toString()] == 3)
                            return highSize * (bubbleSize_selection/50);
                        else if(d["factorized_bubbleSize_" + (Visual.riskDateSelectedFactorValue).toString()] == 4)
                            return veryHighSize * (bubbleSize_selection/50);
                    },
                    "fill": function(d, index){ //private bubble_colors_map = ["#FF0000"/RED, "#FFC000"/AMBER, "#00AC50"/GREEN]
                        if(d["factorized_bubbleColor_" + (Visual.riskDateSelectedFactorValue).toString()] == 1)
                            return red; //return "#FF0000"; //this.RED_COLOR;
                        else if(d["factorized_bubbleColor_" + (Visual.riskDateSelectedFactorValue).toString()] == 2)
                            return amber;   //return "#FFC000"; //this.AMBER_COLOR;
                        else if(d["factorized_bubbleColor_" + (Visual.riskDateSelectedFactorValue).toString()] == 3)
                            return green;   //return "#00AC50"; //this.GREEN_COLOR;
                    },
                    "dummyAngle": function(d, index){return d["angle_" + (Visual.riskDateSelectedFactorValue).toString()];}
                    
                })
                /*.on("mouseover", (d) => {
                    let mouse = d3.mouse(this.svgContainer.node());
                    let x = mouse[0];
                    let y = mouse[1];

                    Visual.host.tooltipService.show({
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

                    Visual.host.tooltipService.move({
                        dataItems: d.tooltips,
                        identities: [d.identity],
                        coordinates: [x, y],
                        isTouchEvent: false
                    });
                })
                .on("mouseout", (d) => {
                    Visual.host.tooltipService.hide({
                        immediately: true,
                        isTouchEvent: false
                    });
                })*/
                //.transition()
                //.duration(500)
                //.ease(d3.easeLinear)
                //.attr("r", 5)
                ;

            console.log("Before RiskBubbles Label: Visual.viewModel.riskBubbles:==>", Visual.viewModel.riskBubbles);
            //RISK BUBBLES LABEL
            let redColorLabel = this.settings.riskBubble.redColorLabel.value;
            let amberColorLabel = this.settings.riskBubble.amberColorLabel.value;
            let greenColorLabel = this.settings.riskBubble.greenColorLabel.value;

            this.riskBubblesGroup
            .selectAll(".riskBubbles")
            .data(Visual.viewModel.riskBubbles)
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
            //.style("font-size", 10)
            //.style("font-size", this.settings.riskBubble.labelFontSize.value)
            .style("font-size", 0)
            .style("text-anchor", "middle")
            
            .attr({
                "transform": function(d, index){let coors = (Math.abs(width/2) + radialAxisScale(d.y) * Math.cos((1 * Math.PI * (270 + d.angle))/180)).toString() + "," + (Math.abs(height/2) + radialAxisScale(d.y) * Math.sin((1 * Math.PI * (270 + d.angle))/180)).toString(); return 'translate(' + coors + ')';},
                dy: "0.2em"
                })
            .text(function(d, i){ /*console.log("--", d, i, global_angularAxisFactorLevels);*/ return d.bubbleLabel;}) 
            //SAFE: .on("mouseover", (d) => {
            .on("mouseover", (d) => {
                let mouse = d3.mouse(this.svgContainer.node());
                let x = mouse[0];
                let y = mouse[1];

                Visual.host.tooltipService.show({
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

                Visual.host.tooltipService.move({
                    dataItems: d.tooltips,
                    identities: [d.identity],
                    coordinates: [x, y],
                    isTouchEvent: false
                });
            })
            .on("mouseout", (d) => {
                Visual.host.tooltipService.hide({
                    immediately: true,
                    isTouchEvent: false
                });
            })
            .transition()
            .duration(1800)
            .style("font-size", this.settings.riskBubble.labelFontSize.value)
            ;

            /*this.riskBubblesGroup
            .on('mouseover', function(d,i) {
                console.log("MOUSE OVERED");
                d3.select(this).transition()
                  .ease('cubic-out')
                  .duration(200)
                  .attr('font-size', 32)
                  .attr('fill', 'springgreen');
              })
              .on('mouseout', function(d,i) {
                console.log("MOUSE OUTED");
                d3.select(this).transition()
                  .ease('cubic-out')
                  .duration(200)
                  .attr('font-size', 20)
                  .attr('fill', '#333');
              });
              */
             
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

        public static repeatArray(array: Array<any>, times: number): Array<any>{ //Call signuature: repeatArray([1,2,3,4], 3); will return: [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3]

            // Create an array of size "n" with undefined values
            var arrays = Array.apply(null, new Array(times)); 

            // Replace each "undefined" with our array, resulting in an array of n copies of our array
            arrays = arrays.map(function() { return array });

            // Flatten our array of arrays
            return [].concat.apply([], arrays);
        }

        public static seq(start: number, end: number, length_out: number): Array<number>{//Call signature: seq(0, 1, 3): output: [0, 0.5, 1]
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
                ////DEBUG: console.log(columnName, "factorsArray is null");
                factorsArray = this.getUnique(columnName, viewModel);
                //console.log("-=typeof(factorsArray)=-", typeof(factorsArray));
                //console.log(":::What is factorsArray:::", factorsArray);
            }

            //else{
            ////DEBUG: console.log(columnName, "factorArray is provided")
            for(let i = 0; i < Object.keys(factorsArray).length; i++){ //The best and robust way to get length of Object https://stackoverflow.com/questions/5223/length-of-a-javascript-object
                factorsArrayInObject[i] = factorsArray[i];
                  //}
            }
            viewModel.riskBubbles.forEach(magicFunction);

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
                else if(columnName == "riskDate"){
                    objectItem["factorized_riskDate"] = factorsArrayInObject.indexOf(objectItem.riskDate) + 1;
                }
                //console.log("-==-", factorsArray.indexOf(objectItem.angularAxis));
                //console.log(objectItem);
            }

            ////DEBUG: console.log("----", viewModel);

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
        private static getViewModel(options: VisualUpdateOptions): ViewModel{
            let dv = options.dataViews; //options is of type VisualUpdateOptions which holds information about viewport height/width/dataViews
            //console.log("dataView from INSIDE(getViewModel):==>", dv[0].categorical.categories);
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
            
            //console.log("------------------", Visual.isAngularAxisDrilledDown);
            //if(!Visual.isAngularAxisDrilledDown){

            let metadata = dv[0].metadata;
            let parentLabelColumnName = metadata.columns.filter(c => c.roles["parentLabel"])[0].displayName;
            let angularAxisColumnName = metadata.columns.filter(c => c.roles["angularAxis"])[0].displayName;
            let radialAxisColumnName = metadata.columns.filter(c => c.roles["radialAxis"])[0].displayName;
            let bubbleSizeColumnName = metadata.columns.filter(c => c.roles["bubbleSize"])[0].displayName;
            let bubbleColorColumnName = metadata.columns.filter(c => c.roles["bubbleColor"])[0].displayName;
            let bubbleLabelColumnName = metadata.columns.filter(c => c.roles["bubbleLabel"])[0].displayName;
            let riskOwnerColumnName = metadata.columns.filter(c => c.roles["riskOwner"])[0].displayName;
            let riskDateColumnName = metadata.columns.filter(c => c.roles["riskDate"])[0].displayName;
            //let values = view.values[0];
            
            //console.log("**Length of for loop**", categories[0].values.length, categories[1].values.length, categories[2].values.length, categories[3].values.length, categories[4].values.length, categories[5].values.length);
            
            //for (let i = 0, len = Math.max(categories.values.length, values.values.length, third_values.values.length); i < len; i++) {
            for (let i = 0, len = Math.max(categories[0].values.length, categories[1].values.length, categories[2].values.length, categories[3].values.length, categories[4].values.length, categories[5].values.length); i < len; i++) {
                viewModel.riskBubbles.push({
                    /*category: <string>categories.values[i],
                    value: <string>values.values[i],
                    third_value: <string>third_values.values[i]
                    */
                    //.replace(/[\W_]+/g," ") //replaces all non-alphanumeric_space with nothing
                    //.replace(/[^\x00-\x7F]/g, ""); ////replaces all non-ascii(0-127 range in hex: 00 - 7F) with nothing
                    parentLabel: <string>categories[0].values[i],
                    angularAxis: <string>categories[1].values[i].toString().trim(),  
                    radialAxis: <string>categories[2].values[i],
                    bubbleSize: <string>categories[3].values[i],
                    bubbleColor: <string>categories[4].values[i],
                    bubbleLabel: <string>categories[5].values[i],
                    riskOwner: <string>categories[6].values[i].toString().replace(/[^\x00-\x7F]/g, "").trim(),
                    riskDate: <string>categories[7].values[i],  //Date is in d-m-yyyy format. Example: 1st March 2019 as: 1-3-2019

                    factorized_angularAxis: -1,
                    factorized_radialAxis: -1,
                    factorized_bubbleColor: -1,
                    factorized_bubbleSize: -1,
                    factorized_riskDate: -1,
                    n_points: 0,
                    angular_width: 0,
                    risks_per_angularField: 0,
                    x_partition: 0,
                    y_partition: 0,
                    x: 0,
                    y: 0,
                    angle: 0,
                    //riskDateMilliseconds: new Date(<string>categories[7].values[i]).getTime(),
                    riskDateMilliseconds: new Date(parseInt(categories[7].values[i].toString().split("-")[2]), parseInt(categories[7].values[i].toString().split("-")[1]) - 1, parseInt(categories[7].values[i].toString().split("-")[0])).getTime(),

                    identity: Visual.host.createSelectionIdBuilder()
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
                        },
                        {
                        displayName: riskOwnerColumnName,
                        value: <string>categories[6].values[i] //<string>categories[5].values[i]
                        },
                        {
                        displayName: riskDateColumnName,
                        value: <string>categories[7].values[i] //<string>categories[5].values[i]
                        }
                    ]
                });
            }
            //}//Close of if(!Visual.isAngularAxisDrilledDown) body

            //viewModel.maxValue = d3.max(viewModel.dataPoints, d => d.value);
            //viewModel.outerMostRadius = 0;
            viewModel.riskBubbles.sort((a,b) => a.riskDateMilliseconds - b.riskDateMilliseconds);
            //viewModel.riskBubbles.sort((a,b) => parseInt(a.bubbleLabel) - parseInt(b.bubbleLabel));
            return viewModel;
            //return null;
        }

        public getViewModelDrillDown(options: VisualUpdateOptions, angularAxisSelected: string): ViewModel{
            let dv = options.dataViews; //options is of type VisualUpdateOptions which holds information about viewport height/width/dataViews
            console.log("dataView from INSIDE(getViewModelDrillDown):==>", angularAxisSelected);
            let viewModel: ViewModel = {
                riskBubbles: []//,
                //outerMostRadius: 123
            };

            //Visual.isAngularAxisDrilledDown = false;

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
            
            //console.log("------------------", Visual.isAngularAxisDrilledDown);
            //if(!Visual.isAngularAxisDrilledDown){

            let metadata = dv[0].metadata;
            let parentLabelColumnName = metadata.columns.filter(c => c.roles["parentLabel"])[0].displayName;
            let angularAxisColumnName = metadata.columns.filter(c => c.roles["angularAxis"])[0].displayName;
            let radialAxisColumnName = metadata.columns.filter(c => c.roles["radialAxis"])[0].displayName;
            let bubbleSizeColumnName = metadata.columns.filter(c => c.roles["bubbleSize"])[0].displayName;
            let bubbleColorColumnName = metadata.columns.filter(c => c.roles["bubbleColor"])[0].displayName;
            let bubbleLabelColumnName = metadata.columns.filter(c => c.roles["bubbleLabel"])[0].displayName;
            let riskOwnerColumnName = metadata.columns.filter(c => c.roles["riskOwner"])[0].displayName;
            let riskDateColumnName = metadata.columns.filter(c => c.roles["riskDate"])[0].displayName;
            //let values = view.values[0];
            //console.log("**Length of for loop**", categories.values.length, values.values.length, third_values.values.length);
            console.log("**Length of for loop**", categories[0].values.length, categories[1].values.length, categories[2].values.length, categories[3].values.length, categories[4].values.length, categories[5].values.length);
            
            //for (let i = 0, len = Math.max(categories.values.length, values.values.length, third_values.values.length); i < len; i++) {
            for (let i = 0, len = Math.max(categories[0].values.length, categories[1].values.length, categories[2].values.length, categories[3].values.length, categories[4].values.length, categories[5].values.length); i < len; i++) {
                console.log("Department:==>", <string>categories[1].values[i], angularAxisSelected);
                if(<string>categories[1].values[i] == angularAxisSelected){
                    viewModel.riskBubbles.push({
                        /*category: <string>categories.values[i],
                        value: <string>values.values[i],
                        third_value: <string>third_values.values[i]
                        */
                       //.replace(/[\W_]+/g," ") //replaces all non-alphanumeric_space with nothing
                       //.replace(/[^\x00-\x7F]/g, ""); ////replaces all non-ascii(0-127 range in hex: 00 - 7F) with nothing
                        parentLabel: <string>categories[1].values[i],
                        angularAxis: <string>categories[6].values[i].toString().replace(/[^\x00-\x7F]/g, "").trim(),  
                        radialAxis: <string>categories[2].values[i],
                        bubbleSize: <string>categories[3].values[i],
                        bubbleColor: <string>categories[4].values[i],
                        bubbleLabel: <string>categories[5].values[i],
                        riskOwner: <string>categories[0].values[i].toString().trim(),
                        riskDate: <string>categories[7].values[i],

                        factorized_angularAxis: -1,
                        factorized_radialAxis: -1,
                        factorized_bubbleColor: -1,
                        factorized_bubbleSize: -1,
                        factorized_riskDate: -1,
                        n_points: 0,
                        angular_width: 0,
                        risks_per_angularField: 0,
                        x_partition: 0,
                        y_partition: 0,
                        x: 0,
                        y: 0,
                        angle: 0,
                        //riskDateMilliseconds: new Date(<string>categories[7].values[i]).getTime(),
                        riskDateMilliseconds: new Date(parseInt(categories[7].values[i].toString().split("-")[2]), parseInt(categories[7].values[i].toString().split("-")[1]) - 1, parseInt(categories[7].values[i].toString().split("-")[0])).getTime(),

                        identity: Visual.host.createSelectionIdBuilder()
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
                            },
                            {
                            displayName: riskOwnerColumnName,
                            value: <string>categories[6].values[i] //<string>categories[5].values[i]
                            },
                            {
                            displayName: riskDateColumnName,
                            value: <string>categories[7].values[i] //<string>categories[5].values[i]
                            }
                        ]
                    });
                }
            }
            //}//Close of if(!Visual.isAngularAxisDrilledDown) body

            //viewModel.maxValue = d3.max(viewModel.dataPoints, d => d.value);
            //viewModel.outerMostRadius = 0;
            viewModel.riskBubbles.sort((a,b) => a.riskDateMilliseconds - b.riskDateMilliseconds);
            //viewModel.riskBubbles.sort((a,b) => parseInt(a.bubbleLabel) - parseInt(b.bubbleLabel));
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

            this.settings.playAxis.tickLabelFontColor.value = this.fetchColorCodeFromObject(options, "playAxis", "color", this.settings.playAxis.tickLabelFontColor.default);
            this.settings.playAxis.tickLabelFontSize.value = DataViewObjects.getValue(options.dataViews[0].metadata.objects, { objectName: "playAxis", propertyName: "fontSize" }, this.settings.playAxis.tickLabelFontSize.default);
            this.settings.playAxis.show.value = DataViewObjects.getValue(options.dataViews[0].metadata.objects, { objectName: "playAxis", propertyName: "show" }, this.settings.playAxis.show.default);

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

                case "playAxis":
                    properties.push({
                        objectName: propertyGroupName,
                        properties: {
                            color: this.settings.playAxis.tickLabelFontColor.value,
                            fontSize: this.settings.playAxis.tickLabelFontSize.value,
                            show: this.settings.playAxis.show.value
                        },
                        selector: null
                    });
                    break;
            };

            return properties;
        }

        public similarity(s1: string, s2: string): number {
            var longer = s1;
            var shorter = s2;
            if (s1.length < s2.length) {
              longer = s2;
              shorter = s1;
            }
            var longerLength:number = longer.length;
            if (longerLength == 0) {
              return 1.0;
            }
            return (longerLength - this.editDistance(longer, shorter)) / parseFloat(longerLength.toString());
          }

        public editDistance(s1: string, s2: string): number {
            s1 = s1.toLowerCase();
            s2 = s2.toLowerCase();
          
            var costs = new Array();
            for (var i = 0; i <= s1.length; i++) {
              var lastValue = i;
              for (var j = 0; j <= s2.length; j++) {
                if (i == 0)
                  costs[j] = j;
                else {
                  if (j > 0) {
                    var newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1))
                      newValue = Math.min(Math.min(newValue, lastValue),
                        costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                  }
                }
              }
              if (i > 0)
                costs[s2.length] = lastValue;
            }
            return costs[s2.length];
          }

        /*public prepare(d: Array<any>) {
            d.id = d.id;
            d.date = parseDate(d.date);
            return d;
        }*/
            
        /*public step() {
            this.update_playAxis(x.invert(this.currentValue));
            this.currentValue = this.currentValue + (this.targetValue/151);
            if (this.currentValue > this.targetValue) {
              this.moving = false;
              this.currentValue = 0;
              clearInterval(timer);
              // timer = 0;
              this.playButton.text("Play");
              console.log("Slider moving: " + this.moving);
            }
          }

        public drawPlot(data: Array<any>, plot: d3.Selection<SVGElement>, width: number, height: number) {
            var locations = plot.selectAll(".location")
              .data(data);
          
            // if filtered dataset has more circles than already existing, transition new ones in
            locations.enter()
              .append("circle")
              .attr("class", "location")
              .attr("cx", function(d) { return x(d.date); })
              .attr("cy", height/2)
              //.style("fill", function(d) { return d3.hsl(d.date/1000000000, 0.8, 0.8)})
              //.style("stroke", function(d) { return d3.hsl(d.date/1000000000, 0.7, 0.7)})
              .style("opacity", 0.5)
              .attr("r", 8)
                .transition()
                .duration(400)
                .attr("r", 25)
                  .transition()
                  .attr("r", 8);
          
            // if filtered dataset has less circles than already existing, remove excess
            locations.exit()
              .remove();
          }
          
          public update_playAxis(h) {
            // update position and text of label according to slider scale
            handle.attr("cx", x(h));
            label
              .attr("x", x(h))
              .text(formatDate(h));
          
            // filter data set and redraw plot
            var newData = dataset.filter(function(d) {
              return d.date < h;
            })
            drawPlot(newData);
          }*/

                      
          /*public step(x_playAxisScale, timer) {
            console.log("this.currentValue:==>", this.currentValue);
            console.log("this.targetValue:==>", this.targetValue);
            console.log("x_playAxisScale.invert(this.currentValue):==>", x_playAxisScale.invert(this.currentValue));
            //console.log("x_playAxisScale.invert(this.currentValue):==>",x_playAxisScale.invert(0));

            this.update_playAxis(x_playAxisScale.invert(this.currentValue), x_playAxisScale);
            this.currentValue = this.currentValue + (this.targetValue/151);
            if (this.currentValue > this.targetValue) {
              this.moving = false;
              this.currentValue = 0;
              clearInterval(timer);
              // timer = 0;
              this.playButtonCircle.text("Play");
              console.log("Slider moving: " + this.moving);
            }
          }

          public update_playAxis(h, x_playAxisScale) {
            // update position and text of label according to slider scale
            this.handle.attr("cx", x_playAxisScale(h));
            this.labelStart
              .attr("x", x_playAxisScale(h))
              .text(this.formatDate(h));
          
            // filter data set and redraw plot
            var newData = this.dataset.filter(function(d) {
              //return d.date < h;
              return new Date(d.date) < h;
              //return 0;
            })
            //drawPlot(newData);
          }*/

          public static callMe1(){
              console.log("Function called");
              //this.get_dateSpecificFilterVM_thenSetFollowing_cumulativeAngularWidth_angularTickLabels_angularPosition_Array(1, radialAxis_1_weight, radialAxis_2_weight, radialAxis_3_weight, radialAxis_4_weight)

          }
        public static getBubblesDetailsObject(){
            Visual.bubblesDetailsObject = {};
            
            let particularRisk = null;
            for(var obj in Visual.viewModel.riskBubbles){ //obj is index number of riskBubble[] array
                //console.log(obj, Visual.viewModel.riskBubbles[obj]["factorized_riskDate"]);
                particularRisk = Visual.viewModel.riskBubbles[obj];
                if(Visual.bubblesDetailsObject[particularRisk["factorized_riskDate"]] == null){
                    Visual.bubblesDetailsObject[particularRisk["factorized_riskDate"]] = {};
                }
                Visual.bubblesDetailsObject[particularRisk["factorized_riskDate"]][particularRisk["bubbleLabel"]] = {"bubbleSize": particularRisk["bubbleSize"], 
                    "x": particularRisk["x"], 
                    "y": particularRisk["y"],
                    "angle": particularRisk["angle"],
                    "factorized_bubbleColor": particularRisk["factorized_bubbleColor"], 
                    "factorized_bubbleSize": particularRisk["factorized_bubbleSize"],
                    "factorized_riskDate": particularRisk["factorized_riskDate"],
                    "bubbleLabel": particularRisk["bubbleLabel"]};

                /*Visual.bubblesDetailsObject[99999][particularRisk["bubbleLabel"]] = {"bubbleSize": particularRisk["bubbleSize"], 
                    "x": particularRisk["x"], 
                    "y": particularRisk["y"],
                    "angle": particularRisk["angle"],
                    "factorized_bubbleColor": particularRisk["factorized_bubbleColor"], 
                    "factorized_bubbleSize": particularRisk["factorized_bubbleSize"],
                    "factorized_riskDate": particularRisk["factorized_riskDate"],
                    "bubbleLabel": particularRisk["bubbleLabel"]};*/
            }
            console.log("^^^^^Visual.bubblesDetailsObject, Visual.viewModel", Visual.bubblesDetailsObject, Visual.viewModel);
        }

        public static get_dateSpecificFilterVM_thenSetFollowing_cumulativeAngularWidth_angularTickLabels_angularPosition_Array(riskDateSelectedFactorValue, radialAxis_1_weight, radialAxis_2_weight, radialAxis_3_weight, radialAxis_4_weight){
            console.log("riskDateSelectedFactorValue:====>(get_dateSpecificFilterVM_thenSetFollowing_cumulativeAngularWidth_angularTickLabels_angularPosition_Array)", riskDateSelectedFactorValue);
            Visual.viewModel.riskBubbles = Visual.viewModel.riskBubbles.filter(function f(value, index, self){ return value.factorized_riskDate == riskDateSelectedFactorValue ; }); //&& operator also works
            //console.log("DEBUG#2218: REACHED", Visual.viewModel.riskBubbles);
            //caluclate angularWeight for each angular sector
            for (let angularAxisFactorItem_index in this.angularAxisFactorLevels){ //angularAxisFactorItem_index is number
                
                let currentAngularAxisName = this.angularAxisFactorLevels[angularAxisFactorItem_index];
                //console.log("**", angularAxisFactorItem_index, currentAngularAxisName);
                this.angularWeight_Array[angularAxisFactorItem_index] = 
                                                radialAxis_1_weight * this.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.factorized_radialAxis == 1; }).length
                                                + radialAxis_2_weight * this.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.factorized_radialAxis == 2; }).length
                                                + radialAxis_3_weight * this.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.factorized_radialAxis == 3; }).length
                                                + radialAxis_4_weight * this.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.factorized_radialAxis == 4; }).length;

            if(this.angularWeight_Array[angularAxisFactorItem_index] == 0)
                    this.angularWeight_Array[angularAxisFactorItem_index] = 3 * 1; //In some cases, angular Axis like Risk Owner names contain non-english characters and hence are assigned angle = 0 and hence angularWidth = 0, so their risk bubbles just show up at origin.
            
            }
            //get totalAngularWeight based on each sector's angularWeight
            this.totalAngularWeight = this.angularWeight_Array.reduce(function getSum(total, value, index, array){ return total + value});  //https://www.w3schools.com/js/tryit.asp?filename=tryjs_es5_array_reduce
            
            //once totalAngularWeight is calculated, now calculate the angularWidth_Array
            for (let angularAxisFactorItem_index in this.angularAxisFactorLevels){ // 0-based angularAxisFactorItem_index is number in string type
                let currentAngularAxisName = this.angularAxisFactorLevels[angularAxisFactorItem_index];
                
                //console.log("***", angularAxisFactorItem_index, this.angularWeight_Array[angularAxisFactorItem_index], this.totalAngularWeight );
                this.angularWidth_Array.push(Math.abs( (360 *  this.angularWeight_Array[angularAxisFactorItem_index] )/ this.totalAngularWeight )); //SAFE: Math.floor
            }
            //get cumulative Angular Width for each angular Axis. get positions of each angular tick labels.
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
            //console.log("--------------START: Inside function: get_dateSpecificFilterVM_thenSetFollowing_cumulativeAngularWidth_angularTickLabels_angularPosition_Array-------------------");
            //console.log("0.Visual.viewModel:==>", Visual.viewModel);
            /*console.log("1.Visual.angularWeight_Array", Visual.angularWeight_Array, "&&totalAngularWeight", Visual.totalAngularWeight);
            console.log("2.Visual.angularWidth_Array", Visual.angularWidth_Array);
            console.log("3.Visual.cumulativeAngularWidth_Array", Visual.cumulativeAngularWidth_Array);
            console.log("4.Visual.angularTickLabels_angularPosition_Array", Visual.angularTickLabels_angularPosition_Array);   
            */ 
            //console.log("--------------END: Inside function: get_dateSpecificFilterVM_thenSetFollowing_cumulativeAngularWidth_angularTickLabels_angularPosition_Array-------------------"); 
            
        }


        public static set_plottingEssentialColumnsInViewModelRiskBubbles(){
            Visual.start_CoordinateRange_x = Visual.offset;
            Visual.end_CoordinateRange_x = 1 - Visual.offset;
            Visual.start_CoordinateRange_y = Visual.offset;
            Visual.end_CoordinateRange_y = 1 - Visual.offset;
            let n_points: number = 0, x_partition: number = 0, y_partition: number = 0, each_split: number = 0;

            let x_vector_data: Array<number> = [];
            let y_vector_data: Array<number> = [];

            //Process RiskBubbles Array to include Columns: 1. n_points, 2. risks_per_angularField, 3. angular_width 4. x_partition 5. y_partition, 6. x, 7. y, 8. angle
            for (let angularAxisFactorItem_index in Visual.angularAxisFactorLevels){ //0-based angularAxisFactorItem_index is number in string type: "0", "1", "2", "3", ..
                for (let radialAxisFactorItem_index in Visual.radialAxisFactorLevels){ //0-based radialAxisFactorItem_index is number in string type: "0", "1", "2", "3", ..
                    
                    let currentAngularAxisName = Visual.angularAxisFactorLevels[angularAxisFactorItem_index];
                    let currentRadialAxisName = Visual.radialAxisFactorLevels[radialAxisFactorItem_index];
                    Visual.riskPerAngularField = Visual.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName; }).length;

                    if( Visual.riskPerAngularField/Visual.totalNumberOfRisks > 2/6){  //CASE: Large amount(1/3rd of total) of risk are on that particular angular sector. So plot risks till the edge
                        Visual.offset = 0.1; //0.05
                        Visual.start_CoordinateRange_x = Visual.offset;
                        Visual.end_CoordinateRange_x = 1 - Visual.offset;
                      }
                      else if( Visual.riskPerAngularField/Visual.totalNumberOfRisks > 1/6){
                        Visual.offset = 0.15
                        Visual.start_CoordinateRange_x = Visual.offset;
                        Visual.end_CoordinateRange_x = 1 - Visual.offset;
                      }
                      else{
                        Visual.offset = 0.1
                        Visual.start_CoordinateRange_x = Visual.offset;
                        Visual.end_CoordinateRange_x = 1 - Visual.offset;
                      }
                    
                      Visual.start_CoordinateRange_y = 0.2;
                    Visual.end_CoordinateRange_y = 0.8;

                    n_points = Visual.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; }).length
                    if(n_points != 0){
                        if(n_points > 8)  //REASON: In case of higher n_points, because of chess pattern x_partition * y_partition is not equal to n_points.
                            x_partition = Math.ceil(Math.sqrt( n_points )) + 1;    
                        else
                            x_partition = Math.ceil(Math.sqrt( n_points ));    
                        y_partition = Math.ceil( (n_points + 1)/x_partition );
                    }
                    else{//CASE: n_points == 0
                        x_partition = 0;
                        y_partition = 0;
                    }

                    for (let index in Visual.viewModel.riskBubbles){ //0-based index is number in string type: "0", "1", "2", "3", ..
                        //console.log("index in viewModel.riskBubble:==>", index);
                        if(Visual.viewModel.riskBubbles[index].angularAxis == currentAngularAxisName && Visual.viewModel.riskBubbles[index].radialAxis == currentRadialAxisName){
                            Visual.viewModel.riskBubbles[index].n_points = n_points;
                            Visual.viewModel.riskBubbles[index].risks_per_angularField = Visual.riskPerAngularField;
                            Visual.viewModel.riskBubbles[index].angular_width = Math.abs( (360 *  Visual.angularWeight_Array[angularAxisFactorItem_index] )/ Visual.totalAngularWeight );
                            Visual.viewModel.riskBubbles[index].x_partition = x_partition;
                            Visual.viewModel.riskBubbles[index].y_partition = y_partition;
                        }
                    }
                    
                    if(x_partition == 1){
                        each_split = (Visual.end_CoordinateRange_x - Visual.start_CoordinateRange_x)/1;
                    }
                    else if(x_partition > 1){
                        each_split = (Visual.end_CoordinateRange_x - Visual.start_CoordinateRange_x)/(x_partition - 1);
                    }

                    if(x_partition > 0){
                        if(x_partition == 1){
                            x_vector_data = [0.5, 0.5];
                        }
                        else{
                        //x_vector_data <- rep(c(seq(start_CoordinateRange_x, end_CoordinateRange_x, length.out = x_partition), c(seq(start_CoordinateRange_x + each_split/2, end_CoordinateRange_x - each_split/2, length.out = x_partition - 1)  )  ), times = ceiling(y_partition/2 )) 
                        x_vector_data =  Visual.repeatArray( this.seq(Visual.start_CoordinateRange_x, Visual.end_CoordinateRange_x, x_partition).concat(this.seq(Visual.start_CoordinateRange_x + each_split/2, Visual.end_CoordinateRange_x - each_split/2, x_partition -1) ), Math.ceil(y_partition/2) + 1  );// this.repeatArray( this.seq(this.start_CoordinateRange_x, this.end_CoordinateRange_x, x_partition).concat(this.seq(this.start_CoordinateRange_x + each_split/2, this.end_CoordinateRange_x - each_split/2, x_partition - 1))  )  ), times = ceiling(y_partition/2 )) 
                        
                        }

                        let y_vector: Array<number> = Visual.seq(Visual.end_CoordinateRange_y, Visual.start_CoordinateRange_y, y_partition) // y vector data revsersed so that bubbles plotting starts from away to the center to toward the center. It helps in reducing overlap.
                        y_vector_data = []  //Initialize with empty array.
                        for(let i:number = 1; i <= y_partition; i++){
                            //SAFE: y_vector_data <- c(y_vector_data, rep(y_vector[i], times = x_partition))
                            if(i % 2 == 1){
                              //SAFE: y_vector_data = y_vector_data.concat( Visual.repeatArray([y_vector[i-1]], x_partition));
                              y_vector_data = y_vector_data.concat( Visual.repeatArray([y_vector[i-1]], x_partition));
                              //y_vector_data = y_vector_data.concat([y_vector_data[y_vector_data.length - 1]]);
                            }
                            else
                            {
                              //SAFE: y_vector_data = y_vector_data.concat( this.repeatArray([y_vector[i-1]], x_partition - 1) ); //rep(y_vector[i], times = x_partition - 1))
                              y_vector_data = y_vector_data.concat( this.repeatArray([y_vector[i-1]], x_partition -1) );
                              //y_vector_data = y_vector_data.concat([y_vector_data[y_vector_data.length - 1]]);
                            }
                          }
                    }
                    if(n_points == 2)
                    {
                        x_vector_data = [0.5, 0.5]
                        y_vector_data = [Visual.start_CoordinateRange_y, Visual.end_CoordinateRange_y]
                    }
                    if(n_points == 1)
                    {
                        x_vector_data = [0.5];y_vector_data = [0.5]
                    }

                    //let number_of_bubbles_in_angular_sector = this.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName  } ).length;  //nrow(risk_register_data[risk_register_data$angularAxis == angular_item , ] )
                    let number_of_bubbles_in_full_row = y_vector_data.indexOf(Math.min.apply(null, y_vector_data)); // https://stackoverflow.com/questions/1669190/find-the-min-max-element-of-an-array-in-javascript //match(min(y_vector_data), y_vector_data) - 1 //SAFE: match(0.2, vector) gives index of first 0.2 found.
                    let number_of_bubbles_in_last_row = n_points - number_of_bubbles_in_full_row
                    let improved_x_vector_data = null;

                    if(number_of_bubbles_in_last_row > 0 && number_of_bubbles_in_last_row < 2){
                    //if(number_of_bubbles_in_last_row > 100000 && number_of_bubbles_in_last_row < 200000){ //number_of_bubbles_in_angular_sector < 10)
                        improved_x_vector_data = x_vector_data.slice(0, number_of_bubbles_in_full_row).concat( this.seq(Visual.start_CoordinateRange_x, Visual.end_CoordinateRange_x, number_of_bubbles_in_last_row + 2).slice(1, number_of_bubbles_in_last_row + 1) );  //c(x_vector_data[1:number_of_bubbles_in_full_row], seq(start_CoordinateRange_x, end_CoordinateRange_x, length.out = number_of_bubbles_in_last_row + 2)[-c(1, number_of_bubbles_in_last_row + 2)]  )
                    }
                    else{
                        improved_x_vector_data = x_vector_data
                    }

                    //console.log("improved_x_vector_data:==>", improved_x_vector_data);
                    for(let i:number = 0; i < n_points; i++){ //  in 1:nrow(risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, ] )) {
                        //risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "x"][i] <- improved_x_vector_data[i] + risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "angularAxis"][i] - 1.0  #- 0.5
                        Visual.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; })[i].x = improved_x_vector_data[i] + Visual.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; })[i].factorized_angularAxis - 1.0;
                        if(isNaN(improved_x_vector_data[i] + Visual.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; })[i].factorized_angularAxis - 1.0) )
                            console.log("*********************NAN************************(i, n_points, improved_x_vector_data)", i, n_points, improved_x_vector_data);
                        //risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "y"][i] <- y_vector_data[i] + risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "radialAxis"][i] #-0.5
                        Visual.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; })[i].y = y_vector_data[i] + Visual.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; })[i].factorized_radialAxis;
                        if(isNaN(y_vector_data[i] + Visual.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; })[i].factorized_radialAxis) )
                            console.log("*********************NAN************************(i, n_points, y_vector_data)", i, n_points, y_vector_data);
                        //#SAFE: risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "angle"][i] <- as.integer( (x_vector_data[i] + risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "angularAxis"][i] - 1.0)*(360/number_of_sectors) ) 
                        //risk_register_data[risk_register_data$angularAxis == angular_item & risk_register_data$radialAxis == radial_item, "angle"][i] <- as.integer( (improved_x_vector_data[i])* as.integer(angularWidth_list[as.integer(angular_item)]) + as.integer(cumulative_angularWidth_list[as.integer(angular_item)])) 
                        Visual.viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; })[i].angle = ( (improved_x_vector_data[i]) * parseFloat(Visual.angularWidth_Array[parseInt(angularAxisFactorItem_index)]) + parseFloat(Visual.cumulativeAngularWidth_Array[parseInt(angularAxisFactorItem_index)])); //y_vector_data[i] + viewModel.riskBubbles.filter(function f(value, index, self){ return value.angularAxis == currentAngularAxisName && value.radialAxis == currentRadialAxisName; })[i].factorized_radialAxis;
                    }
                    //console.log(">>>>>>>>>>>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<<<")
                }
            }
            console.log("--------------END: Inside function: set_plottingEssentialColumnsInViewModelRiskBubbles-------------------");
            console.log("**Visual.viewModel:==>", Visual.viewModel);
            /*console.log("**Visual.sentinelChartTitle", Visual.sentinelChartTitle);
            console.log("**Visual.angularWeight_Array:==>", Visual.angularWeight_Array);
            console.log("**Visual.angularTickLabels_angularPosition_Array:==>", Visual.angularTickLabels_angularPosition_Array);
            console.log("**Visual.angularWidth_Array:==>", Visual.angularWidth_Array);
            console.log("**Visual.cumulativeAngularWidth_Array:==>", Visual.cumulativeAngularWidth_Array);
            */

            //console.log("--------------END: Inside function: set_plottingEssentialColumnsInViewModelRiskBubbles-------------------");
        } //END: set_plottingEssentialColumnsInViewModelRiskBubbles

    }
}