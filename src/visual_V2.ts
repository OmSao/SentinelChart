/*
Author: Om Prakash Sao
Date: 26th July 2019
Client: SHIFT Consulting
Comments: V1 + working 3 fields for data. Once you put Don't summarize in all the integer/number column, you will get right result in View Data or Browser console
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
        category: string;
        value: string;
        third_value: string;

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
        private radialAxisTicks : d3.Selection<SVGElement>;
        private radialAxis : d3.Selection<SVGElement>;
        private radialAxisTickLabels = ["Latent", "Immediate / already impacting", "< 3 months", "> 3 months"];

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

            this.radialAxisTicks = this.svgContainer
                .append("g")
                .classed("radialAxisTickGroupClass", true)
                .attr({
                    transform: "rotate(0)" //SAFE: -90
                });
            this.radialAxisTicks.append("text").classed("radialAxisTickClass", true);
            this.radialAxisTicks.append("text").classed("radialAxisTickClass", true);
            this.radialAxisTicks.append("text").classed("radialAxisTickClass", true);
            this.radialAxisTicks.append("text").classed("radialAxisTickClass", true);

            this.radialAxis = this.svgContainer
                .append("g")
                .attr({
                    transform: "rotate(0)",

                })
                .append("line")
                .classed("radialAxis", true);      
            
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

            let viewModel = this.getViewModel(options);
            console.log("^^^^viewModel^^^^", viewModel);


            let width = options.viewport.width;
            let height = options.viewport.height;

            //let outerMostRadialAxisRadius = Math.min(width, height) / 2 - 50; // radius of the whole chart //SAFE: -30
            let outerMostRadialAxisRadius = Math.min(options.viewport.width, options.viewport.height) / 2 - 50; // radius of the whole chart //SAFE: -30

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

            this.radialAxisTicks
                .selectAll(".radialAxisTickClass")
                .data(this.radialAxisTickLabels)
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
                .data(this.radialAxisTickLabels)
                .style("stroke", "grey")
                .style("stroke-width", 1.5)
                .attr({
                    x1: Math.floor(width / 2),
                    y1: function(d, index){ return Math.floor(height / 2) - radialAxisScale(1); },
                    x2: Math.floor(width / 2),
                    y2: Math.floor(height / 2) - outerMostRadialAxisRadius

                });

        }

        public reMap (oldValue: number): number{
            let oldMin = 0,
            oldMax = -359,
            newMin = 0,
            newMax = (Math.PI * 2),
            newValue = (((oldValue - 90 - oldMin) * (newMax - newMin)) / (oldMax - oldMin)) + newMin;
  
            return newValue;
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
            //console.log("%%%%view.categories%%%%", view.categories[0]);
            //console.log("%%%%view.values%%%%", view.values);
            //let third_values = view.values[1];
            //console.log(categories, values);
            //console.log("**Length of for loop**", categories.values.length, values.values.length, third_values.values.length);
            console.log("**Length of for loop**", categories[0].values.length, categories[1].values.length, categories[2].values.length);
            
            //for (let i = 0, len = Math.max(categories.values.length, values.values.length, third_values.values.length); i < len; i++) {
            for (let i = 0, len = Math.max(categories[0].values.length, categories[1].values.length, categories[2].values.length); i < len; i++) {
                viewModel.riskBubbles.push({
                    /*category: <string>categories.values[i],
                    value: <string>values.values[i],
                    third_value: <string>third_values.values[i]
                    */
                    category: <string>categories[0].values[i],
                    value: <string>categories[1].values[i],
                    third_value: <string>categories[2].values[i]
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