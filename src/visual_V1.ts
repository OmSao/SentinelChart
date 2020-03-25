/*
Author: Om Prakash Sao
Date: 26th July 2019
Client: SHIFT Consulting
Comment: Sentinel concentric circles + Ticks in Radial Axis + Radial Axis straight line.
*/

module powerbi.extensibility.visual {
    "use strict";
    interface Risk {
        /*parentLabel: string;
        angularAxis: string;
        radialAxis: string;*/
        angle: number;
        radius: number;
        size: number;
        label: string;

    };

    interface ViewModel {
        riskBubbles: Risk[];
        outerMostRadius: number;
    };
    export class Visual implements IVisual {
        /*INITIAL SCAFFOLDING
        private target: HTMLElement;
        private updateCount: number;
        private settings: VisualSettings;
        private textNode: Text;*/
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
        private radialAxisTickLabels = ["Latent", "Immediate / already impacting", "< 3 months", "> 3 months"];

        constructor(options: VisualConstructorOptions) {
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
            
        }

        public update(options: VisualUpdateOptions) {
            /*INITIAL SCAFFOLDING 
            this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);
            console.log('Visual update', options);
            if (typeof this.textNode !== "undefined") {
                this.textNode.textContent = (this.updateCount++).toString();
            }*/
            console.log("****UPDATE CALLED****");
            //this.svgContainer.empty(); returns boolean if empty or not.
            //this.radialAxisGroup.selectAll(".radialAxisClass").remove;
            //console.log("****REMOVED?****", this.svgContainer.selectAll(".radialAxisClass").empty());
            //WASTE: this.svgContainer.append("g").classed("radialAxisGroupClass", true);

            let sample: Risk[] = [
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
            }

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
                .data(radiusArray);
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
                .attr({
                    dx: "0.5em",
                    x: Math.floor(width / 2),
                    y: function(d, index){ return (Math.floor(height / 2) - radialAxisScale( index + 2) ); }
                })
                .text(function(d, index){ console.log("--", d, index); return d;});

        }

        public reMap (oldValue: number): number{
            let oldMin = 0,
            oldMax = -359,
            newMin = 0,
            newMax = (Math.PI * 2),
            newValue = (((oldValue - 90 - oldMin) * (newMax - newMin)) / (oldMax - oldMin)) + newMin;
  
            return newValue;
        }

        private static parseSettings(dataView: DataView): VisualSettings {
            console.log("***parseSettings Called***");
            return VisualSettings.parse(dataView) as VisualSettings;
        }

        /** 
         * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the 
         * objects and properties you want to expose to the users in the property pane.
         * 
         */
        /*public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
            return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
        }*/
    }
}