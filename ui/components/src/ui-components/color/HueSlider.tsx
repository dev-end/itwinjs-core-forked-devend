/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Color */

import * as React from "react";
import "./HueSlider.scss";
import classnames from "classnames";

/** Hue (h), Saturation (s), Lightness (l), Alpha (a), Source (source)
 * Value limits h: 0-360, s,l,a: 0-1
 */
export class HSLAColor {
  constructor(public h = 0, public s = 0, public l = 0, public a = 1, public source = "rgb") { }
  public clone(): HSLAColor { const out = new HSLAColor(); out.h = this.h; out.s = this.s; out.l = this.l; out.a = this.a; out.source = this.source; return out; }
}

/** Properties for the [[HueSlider]] React component */
export interface HueSliderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** true if slider is oriented horizontal, else vertical orientation is assumed */
  isHorizontal?: boolean;
  /** function to run when user selects color swatch */
  onHueChange?: ((hue: HSLAColor) => void) | undefined;
  /** HSL with Alpha Color value */
  hsl: HSLAColor;
}

/** HueSlider component used to set the hue value. */
export class HueSlider extends React.PureComponent<HueSliderProps> {
  private _container: HTMLDivElement | null = null;

  constructor(props: HueSliderProps) {
    super(props);
  }

  private _calculateChange = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, isHorizontal: boolean, hsl: HSLAColor, container: HTMLDivElement): HSLAColor | undefined => {
    e.preventDefault();
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    let x = 0;
    if ("pageX" in e) {
      x = (e as React.MouseEvent<HTMLDivElement>).pageX;
    } else {
      if (undefined === e.touches)
        return undefined;
      x = (e as React.TouchEvent<HTMLDivElement>).touches[0].pageX;
    }
    if (undefined === x)
      return undefined;

    let y = 0;
    if ("pageY" in e) {
      y = (e as React.MouseEvent<HTMLDivElement>).pageY;
    } else {
      if (undefined === e.touches)
        return;
      y = (e as React.TouchEvent<HTMLDivElement>).touches[0].pageY;
    }
    if (undefined === y)
      return undefined;

    const left = x - (container.getBoundingClientRect().left + window.pageXOffset);
    const top = y - (container.getBoundingClientRect().top + window.pageYOffset);

    if (!isHorizontal) {
      let h;
      if (top < 0) {
        h = 360;
      } else if (top > containerHeight) {
        h = 0;
      } else {
        const percent = -((top * 100) / containerHeight) + 100;
        h = ((360 * percent) / 100);
      }

      if (hsl.h !== h) {
        return new HSLAColor(h, hsl.s, hsl.l, hsl.a, "rgb");
      }
    } else {  // horizontal
      let h;
      if (left < 0) {
        h = 0;
      } else if (left > containerWidth) {
        h = 360;
      } else {
        const percent = (left * 100) / containerWidth;
        h = ((360 * percent) / 100);
      }

      if (hsl.h !== h) {
        return new HSLAColor(h, hsl.s, hsl.l, hsl.a, "rgb");
      }
    }
    return undefined;
  }

  public componentWillUnmount() {
    this._unbindEventListeners();
  }

  private _onChange = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (this._container && this.props.onHueChange) {
      const change = this._calculateChange(e, this.props.isHorizontal ? this.props.isHorizontal : false, this.props.hsl, this._container);
      change && typeof this.props.onHueChange === "function" && this.props.onHueChange(change);
    }
  }

  private _onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    this._onChange(e);
    if (this._container)
      this._container.focus();
    window.addEventListener("mousemove", this._onChange as any);
    window.addEventListener("mouseup", this._onMouseUp);
  }

  private _onKeyDown = (evt: React.KeyboardEvent<HTMLDivElement>) => {
    let newHue: number | undefined;
    const hueValue = this.props.hsl.clone();
    if (evt.key === "ArrowLeft" || evt.key === "ArrowDown") {
      newHue = hueValue.h - (evt.ctrlKey ? 10 : 1);
    } else if (evt.key === "ArrowRight" || evt.key === "ArrowUp") {
      newHue = hueValue.h + (evt.ctrlKey ? 10 : 1);
    } else if (evt.key === "PageDown") {
      newHue = hueValue.h - (evt.ctrlKey ? 180 : 60);
    } else if (evt.key === "PageUp") {
      newHue = hueValue.h + (evt.ctrlKey ? 180 : 60);
    } else if (evt.key === "Home") {
      newHue = 0;
    } else if (evt.key === "End") {
      newHue = 360;
    }

    if (undefined !== newHue) {
      const newValue = this.props.hsl.clone();
      if (newHue > 360) newHue = 360;
      if (newHue < 0) newHue = 0;
      newValue.h = newHue;
      if (this.props.onHueChange)
        this.props.onHueChange(newValue);
    }
  }

  private _onMouseUp = () => {
    this._unbindEventListeners();
  }

  private _unbindEventListeners() {
    window.removeEventListener("mousemove", this._onChange as any);
    window.removeEventListener("mouseup", this._onMouseUp);
  }

  public render(): React.ReactNode {
    const containerClasses = classnames(
      this.props.isHorizontal ? "components-hue-container-horizontal" : "components-hue-container-vertical",
    );

    const pointerStyle: React.CSSProperties = this.props.isHorizontal ? {
      left: `${(this.props.hsl.h * 100) / 360}%`,
    } : {
        left: `0px`,
        top: `${-((this.props.hsl.h * 100) / 360) + 100}%`,
      };

    return (
      <div className={containerClasses} data-testid="hue-container">
        <div
          data-testid="hue-slider"
          role="slider" aria-label="Hue"
          aria-valuemin={0} aria-valuemax={360} aria-valuenow={this.props.hsl.h}
          className="components-hue-slider"
          ref={(container) => this._container = container}
          onMouseDown={this._onMouseDown}
          onTouchMove={this._onChange}
          onTouchStart={this._onChange}
          tabIndex={0}
          onKeyDown={this._onKeyDown}
        >
          <div style={pointerStyle} className="components-hue-pointer" data-testid="hue-pointer" />
        </div>
      </div>
    );
  }

}
